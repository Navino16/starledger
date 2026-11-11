import { beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/app';
import { type MemoryGm, memoryGm } from '../src/gm';
import { MESSAGES } from '../src/i18n';
import { loadSettings, saveSettings } from '../src/storage';
import { createQueue } from '../src/sync/queue';

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

  it('flushes the queue once on load and registers no listener', async () => {
    const on = vi.fn();
    (globalThis as { $?: unknown }).$ = () => ({ on });
    createQueue(gm);
    main(gm, document);
    await flush();
    expect(on).not.toHaveBeenCalled();
    expect(gm.requests.every((r) => r.url.startsWith('https://sl.example.org'))).toBe(true);
  });

  it('does not flush without server or key', () => {
    saveSettings(gm, { apiKey: null });
    main(gm, document);
    expect(gm.requests).toHaveLength(0);
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

describe('i18n', () => {
  it('has the same keys in fr and en', () => {
    expect(Object.keys(MESSAGES.fr).sort()).toEqual(Object.keys(MESSAGES.en).sort());
  });
});
