import { beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/app';
import { type MemoryGm, memoryGm } from '../src/gm';
import { MESSAGES } from '../src/i18n';
import { loadSettings, saveSettings } from '../src/storage';
import { createQueue } from '../src/sync/queue';

const obs = (id: string) => ({ kind: 'message', clientObservationId: id }) as never;
const ackAll = (opts: { data?: string }) => ({
  status: 200,
  body: JSON.stringify({
    results: (JSON.parse(opts.data ?? '{}').observations ?? []).map(
      (o: { clientObservationId: string }) => ({
        clientObservationId: o.clientObservationId,
        status: 'accepted',
      }),
    ),
  }),
});
const flush = () => new Promise((r) => setTimeout(r, 0));

function page(lang: string, withLinks = true) {
  document.head.innerHTML = `<meta name="ogame-universe" content="s808-en.ogame.gameforge.com"><meta name="ogame-language" content="${lang}">`;
  document.body.innerHTML = withLinks
    ? '<div id="links"><a id="shop">Shop</a></div><div id="footer"></div>'
    : '';
}

let gm: MemoryGm;
beforeEach(() => {
  gm = memoryGm();
  page('en');
  delete (globalThis as { $?: unknown }).$;
});

const click = (sel: string) => (document.querySelector(sel) as HTMLElement).click();
const byText = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement;

describe('without consent', () => {
  it('registers no ajaxSuccess listener, makes no request and shows only the box', () => {
    const on = vi.fn();
    (globalThis as { $?: unknown }).$ = () => ({ on });
    main(gm, document);
    expect(on).not.toHaveBeenCalled();
    expect(gm.requests).toHaveLength(0);
    expect(document.querySelector('#links')?.nextElementSibling?.id).toBe('starledger-box');
    expect(document.querySelectorAll('#starledger-box button')).toHaveLength(1);
  });

  it('inserts nothing when #links is absent but keeps the menu command', () => {
    page('en', false);
    main(gm, document);
    expect(document.getElementById('starledger-box')).toBeNull();
    expect(gm.menus).toHaveLength(1);
  });

  it('does not flush a non-empty queue', async () => {
    saveSettings(gm, { serverUrl: 'https://sl.example.org', apiKey: 'k' });
    createQueue(gm).enqueue([obs('a')]);
    main(gm, document);
    await flush();
    expect(gm.requests).toHaveLength(0);
    expect(createQueue(gm).size()).toBe(1);
  });

  it('does nothing outside the allowed universe', () => {
    document.head.innerHTML = '<meta name="ogame-universe" content="s1-fr.ogame.gameforge.com">';
    main(gm, document);
    expect(gm.menus).toHaveLength(0);
  });

  it('accepting consent requires a valid URL and an explicit click, then saves consent', () => {
    main(gm, document);
    click('#starledger-box button');
    expect(document.body.textContent).toContain('names and coordinates of other players');
    expect(loadSettings(gm).consent).toBe(false);
    const url = document.querySelector('#starledger-url') as HTMLInputElement;
    url.value = 'https://sl.example.org';
    url.dispatchEvent(new Event('input'));
    expect(document.querySelector('#starledger-destination')?.textContent).toBe(
      'https://sl.example.org',
    );
    url.value = 'ftp://nope';
    byText('I consent').click();
    expect(loadSettings(gm).consent).toBe(false);
    url.value = 'https://sl.example.org';
    byText('I consent').click();
    expect(loadSettings(gm)).toMatchObject({ consent: true, serverUrl: 'https://sl.example.org' });
  });
});

describe('with consent', () => {
  beforeEach(() => {
    saveSettings(gm, { consent: true, serverUrl: 'https://sl.example.org', apiKey: 'secret' });
  });

  it('flushes a pending observation once on load and registers no listener', async () => {
    const on = vi.fn();
    (globalThis as { $?: unknown }).$ = () => ({ on });
    createQueue(gm).enqueue([obs('a')]);
    gm.respondWith(ackAll);
    main(gm, document);
    await flush();
    expect(on).not.toHaveBeenCalled();
    expect(gm.requests).toHaveLength(1);
    expect(gm.requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://sl.example.org/api/v1/observations',
    });
    expect(createQueue(gm).size()).toBe(0);
  });

  it.each([{ apiKey: null }, { serverUrl: null }])('does not flush with %o', async (patch) => {
    createQueue(gm).enqueue([obs('a')]);
    saveSettings(gm, patch);
    main(gm, document);
    await flush();
    expect(gm.requests).toHaveLength(0);
    expect(createQueue(gm).size()).toBe(1);
  });

  it('withdrawing during a flush sends no further batch', async () => {
    const q = createQueue(gm);
    q.enqueue(Array.from({ length: 150 }, (_, i) => obs(`o${i}`)));
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    gm.respondWith(async (opts) => {
      await gate;
      return ackAll(opts);
    });
    main(gm, document);
    gm.menus[0]?.fn();
    await flush();
    byText('Withdraw consent').click();
    release();
    await flush();
    expect(gm.requests).toHaveLength(1);
    expect(createQueue(gm).size()).toBe(0);
  });

  it('reapplies the stored hide state after withdrawing and consenting again', () => {
    saveSettings(gm, { hideOglightBox: true });
    main(gm, document);
    expect(document.head.innerHTML).toContain('.ogl_miniStats');
    gm.menus[0]?.fn();
    byText('Withdraw consent').click();
    expect(document.head.innerHTML).not.toContain('.ogl_miniStats');
    click('#starledger-box button');
    byText('I consent').click();
    expect(document.head.innerHTML).toContain('.ogl_miniStats');
    expect((document.querySelector('#starledger-hide') as HTMLInputElement).checked).toBe(true);
  });

  it('does not add the hide rule twice when the panel is reopened', () => {
    saveSettings(gm, { hideOglightBox: true });
    main(gm, document);
    gm.menus[0]?.fn();
    expect(document.querySelectorAll('#starledger-hide-oglight')).toHaveLength(1);
  });

  it('inserts server-provided names literally, without replacement patterns', async () => {
    gm.respondWith(() => ({
      status: 200,
      body: JSON.stringify({ ok: true, username: "a$&b$'c", apiVersion: 1 }),
    }));
    main(gm, document);
    gm.menus[0]?.fn();
    byText('Test connection').click();
    await flush();
    expect(document.querySelector('.starledger-status')?.textContent).toBe("Connected as a$&b$'c");
  });

  it('adds then removes the OGLight rule with the checkbox', () => {
    main(gm, document);
    gm.menus[0]?.fn();
    const box = document.querySelector('#starledger-hide') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(document.head.innerHTML).toContain('.ogl_miniStats{display:none!important}');
    expect(loadSettings(gm).hideOglightBox).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(document.head.innerHTML).not.toContain('.ogl_miniStats');
  });

  it('shows the translated error for invalid_key in French', async () => {
    page('fr');
    gm.respondWith(() => ({ status: 401, body: '{}' }));
    main(gm, document);
    gm.menus[0]?.fn();
    byText('Tester la connexion').click();
    await flush();
    expect(document.querySelector('.starledger-status')?.textContent).toBe('Clé invalide');
  });

  it('never renders the stored key and keeps it when the field is left empty', () => {
    main(gm, document);
    gm.menus[0]?.fn();
    const key = document.querySelector('#starledger-key') as HTMLInputElement;
    expect(key.type).toBe('password');
    expect(key.value).toBe('');
    expect(document.body.innerHTML).not.toContain('secret');
    byText('Save').click();
    expect(loadSettings(gm).apiKey).toBe('secret');
  });

  it('rejects an invalid URL on save', () => {
    main(gm, document);
    gm.menus[0]?.fn();
    (document.querySelector('#starledger-url') as HTMLInputElement).value = 'javascript:1';
    byText('Save').click();
    expect(loadSettings(gm).serverUrl).toBe('https://sl.example.org');
  });

  it('withdrawing consent saves consent:false and empties the queue', () => {
    createQueue(gm).enqueue([{ kind: 'message', clientObservationId: 'a' } as never]);
    main(gm, document);
    gm.menus[0]?.fn();
    byText('Withdraw consent').click();
    expect(loadSettings(gm).consent).toBe(false);
    expect(createQueue(gm).size()).toBe(0);
    expect(document.querySelectorAll('#starledger-box button')).toHaveLength(1);
  });
});

describe('options hardening', () => {
  const type = (sel: string, value: string) => {
    const input = document.querySelector(sel) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const text = () => document.querySelector('#starledger-box')?.textContent ?? '';

  beforeEach(() => {
    saveSettings(gm, { consent: true, serverUrl: 'https://sl.example.org', apiKey: 'secret' });
    main(gm, document);
    gm.menus[0]?.fn();
  });

  it('Test with a changed URL and an empty key sends no request', async () => {
    type('#starledger-url', 'https://other.example.org');
    byText('Test connection').click();
    await flush();
    expect(gm.requests).toHaveLength(0);
    expect(text()).toContain('Enter the API key for this server');
  });

  it('Test with a changed URL uses only the typed key', async () => {
    gm.respondWith(() => ({
      status: 200,
      body: JSON.stringify({ ok: true, username: 'bob', apiVersion: 1 }),
    }));
    type('#starledger-url', 'https://other.example.org');
    type('#starledger-key', '  newkey ');
    byText('Test connection').click();
    await flush();
    expect(gm.requests[0]?.url).toBe('https://other.example.org/api/v1/ping');
    expect(gm.requests[0]?.headers?.Authorization).toBe('Bearer newkey');
  });

  it('Save with a changed URL and no key is refused', () => {
    type('#starledger-url', 'https://other.example.org');
    byText('Save').click();
    expect(loadSettings(gm)).toMatchObject({ serverUrl: 'https://sl.example.org', consent: true });
    expect(text()).toContain('Enter the API key for this server');
  });

  it('Save with a changed URL resets consent and shows the consent screen with the new URL', () => {
    createQueue(gm).enqueue([obs('a')]);
    type('#starledger-url', 'https://other.example.org');
    type('#starledger-key', 'newkey');
    byText('Save').click();
    expect(loadSettings(gm)).toMatchObject({
      serverUrl: 'https://other.example.org',
      apiKey: 'newkey',
      consent: false,
    });
    expect(createQueue(gm).size()).toBe(0);
    expect(document.querySelector('#starledger-destination')?.textContent).toBe(
      'https://other.example.org',
    );
  });

  it('Save with the same URL keeps consent and the stored key', () => {
    byText('Save').click();
    expect(loadSettings(gm)).toMatchObject({ consent: true, apiKey: 'secret' });
  });

  it('Remove key clears the stored key and the placeholder', () => {
    const key = document.querySelector('#starledger-key') as HTMLInputElement;
    expect(key.placeholder).not.toBe('');
    byText('Remove key').click();
    expect(loadSettings(gm).apiKey).toBeNull();
    expect(key.placeholder).toBe('');
  });

  it.each([
    'https://s808-en.ogame.gameforge.com',
    'https://x.gameforge.com',
    'https://gameforge.com/',
  ])('rejects the game host %s', (value) => {
    type('#starledger-url', value);
    type('#starledger-key', 'k');
    byText('Save').click();
    expect(loadSettings(gm).serverUrl).toBe('https://sl.example.org');
    expect(text()).toContain('not an OGame server');
  });

  it('warns about http:// URLs only', () => {
    type('#starledger-url', 'http://192.168.1.2:3000');
    expect(text()).toContain('key will travel in clear text');
    type('#starledger-url', 'https://sl.example.org');
    expect(text()).not.toContain('key will travel in clear text');
  });

  it('trims the key and disables browser autofill', () => {
    const key = document.querySelector('#starledger-key') as HTMLInputElement;
    expect(key.autocomplete).toBe('new-password');
    key.value = '  spaced  ';
    byText('Save').click();
    expect(loadSettings(gm).apiKey).toBe('spaced');
  });

  it.each(['{}', 'null'])('treats a 2xx ping body %s as a server error', async (body) => {
    gm.respondWith(() => ({ status: 200, body }));
    byText('Test connection').click();
    await flush();
    expect(text()).toContain('Server error');
  });
});

describe('consent version', () => {
  it('counts stored consent without a version as no consent', () => {
    gm.set('starledger.settings', { consent: true, deviceId: 'd', serverUrl: 'https://x.test' });
    expect(loadSettings(gm).consent).toBe(false);
    main(gm, document);
    expect(document.querySelectorAll('#starledger-box button')).toHaveLength(1);
  });

  it('counts an older version as no consent and a current one as consent', () => {
    gm.set('starledger.settings', { consent: true, consentVersion: 0, deviceId: 'd' });
    expect(loadSettings(gm).consent).toBe(false);
    saveSettings(gm, { consent: true });
    expect(loadSettings(gm).consent).toBe(true);
  });

  it('tolerates a non-object stored value', () => {
    gm.set('starledger.settings', null);
    expect(loadSettings(gm).consent).toBe(false);
  });

  it('names the data §1.9 lists on the consent screen', () => {
    main(gm, document);
    click('#starledger-box button');
    const text = document.body.textContent ?? '';
    for (const word of ['player id and name', 'fleet departures', 'departure time', 'viewed'])
      expect(text).toContain(word);
  });
});

describe('i18n', () => {
  it('has the same keys in fr and en', () => {
    expect(Object.keys(MESSAGES.fr).sort()).toEqual(Object.keys(MESSAGES.en).sort());
  });
});
