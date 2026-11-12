import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/app';
import { extractMessageObservations } from '../src/collect/messages';
import { type MemoryGm, memoryGm } from '../src/gm';
import { saveSettings } from '../src/storage';
import { createQueue } from '../src/sync/queue';

const FIXTURE = readFileSync(
  join(import.meta.dirname, 'fixtures/messages-expeditions.html'),
  'utf8',
);
const account = { serverId: 808, lang: 'en', playerId: 42, playerName: 'Zed' };
const ctx = { account, serverUtcOffsetMinutes: 60 };
const consented = () => saveSettings(gm, { consent: true });
const flushTick = () => new Promise((r) => setTimeout(r, 0));

type Handler = (e: unknown, xhr: unknown, settings: { url?: string; data?: string }) => void;

function setup(opts: { consent?: boolean; serverTime?: unknown; contentHtml?: string[] } = {}) {
  document.head.innerHTML =
    '<meta name="ogame-universe" content="s808-en.ogame.gameforge.com"><meta name="ogame-player-id" content="42"><meta name="ogame-player-name" content="Zed">';
  document.body.innerHTML = `<div id="links"></div>${FIXTURE}`;
  const handlers: Handler[] = [];
  const messages = {
    get content() {
      reads.push('content');
      return opts.contentHtml ?? [];
    },
  };
  const reads: string[] = [];
  const ogame = new Proxy(
    { messages },
    {
      get(target, prop) {
        reads.push(String(prop));
        return Reflect.get(target, prop);
      },
    },
  );
  const win = {
    serverTime: 'serverTime' in opts ? opts.serverTime : new Date(),
    ogame,
    $: (_t: unknown) => ({ on: (_e: string, h: Handler) => handlers.push(h) }),
  };
  return { win, handlers, reads };
}

let gm: MemoryGm;
beforeEach(() => {
  gm = memoryGm();
});
afterEach(() => vi.restoreAllMocks());

describe('extractMessageObservations', () => {
  it('extracts the 2 tracked expeditions and skips the spy report', () => {
    const root = document.createElement('div');
    root.innerHTML = FIXTURE;
    const out = extractMessageObservations(root, ctx);
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.msgId)).toEqual([1001, 1002]);
    expect(out[0]?.raw.expeditionresult).toBe('ResourceFound');
    expect(out[0]).toMatchObject({ messageType: 41, subtabId: 22, serverUtcOffsetMinutes: 60 });
    expect(out[0]?.raw.timestamp).toBe('1789120800');
    expect(out[0]?.clientObservationId).not.toBe(out[1]?.clientObservationId);
  });

  it('skips a message whose msgId is not numeric', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div class="msg" data-msg-id="abc"><div class="rawMessageData" data-raw-messagetype="41"></div></div>';
    expect(extractMessageObservations(root, ctx)).toEqual([]);
  });
});

const anomalyMsg = (type: number, content: string, body = '') => `
<div class="msg" data-msg-id="2001">
  <span class="msgContent"><a class="txt_link" href="#">[3:44:7]</a> text ${body}</span>
  ${content}
  <div class="rawMessageData" data-raw-messagetype="${type}" data-raw-timestamp="1789120800" data-raw-coords="1:2:3"></div>
</div>`;
const LOOT = `<div class="content-box"><div class="loot-row">
  <div class="loot-item"><resource-icon class="metal size48" aria-description="Metal: 12500"></resource-icon></div>
  <div class="loot-item"><technology-icon class="size48" transportersmall="" aria-description="Small Cargo: 3"></technology-icon></div>
  <div class="loot-item"><foo-icon aria-description="Thing: 2"></foo-icon></div>
  <div class="loot-item"><resource-icon class="crystal" aria-description="Crystal"></resource-icon></div>
</div></div>`;

describe('anomaly reward extraction (type 76)', () => {
  const extract = (html: string) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    return extractMessageObservations(root, ctx);
  };

  it('adds x-loot and x-anomalycoords from the message HTML', () => {
    const [obs] = extract(anomalyMsg(76, LOOT));
    expect(JSON.parse(obs?.raw['x-loot'] ?? 'null')).toEqual([
      { type: 'resource', resource: 'metal', amount: 12500 },
      { type: 'ship', attributes: ['transportersmall'], amount: 3 },
      { type: 'unknown', tag: 'foo-icon', amount: 2 },
      { type: 'resource', resource: 'crystal', amount: null },
    ]);
    expect(obs?.raw['x-anomalycoords']).toBe('3:44:7');
  });

  it('keeps an icon-less loot item as an unknown entry', () => {
    const html = anomalyMsg(
      76,
      `<div class="content-box"><div class="loot-row">
        <div class="loot-item"><resource-icon class="metal" aria-description="Metal: 5"></resource-icon></div>
        <div class="loot-item"><span class="xp">+10</span></div>
        <div class="loot-item"></div>
      </div></div>`,
    );
    expect(JSON.parse(extract(html)[0]?.raw['x-loot'] ?? 'null')).toEqual([
      { type: 'resource', resource: 'metal', amount: 5 },
      { type: 'unknown', tag: 'span', amount: null },
      { type: 'unknown', tag: 'loot-item', amount: null },
    ]);
  });

  it('sets no x-loot without a loot item', () => {
    const [obs] = extract(anomalyMsg(76, ''));
    expect(obs?.raw['x-loot']).toBeUndefined();
    expect(obs?.raw['x-anomalycoords']).toBe('3:44:7');
  });

  it('omits x-anomalycoords when the link is missing or malformed', () => {
    const html = anomalyMsg(76, LOOT).replace('[3:44:7]', 'nowhere');
    expect(extract(html)[0]?.raw['x-anomalycoords']).toBeUndefined();
  });

  it('adds no x- key to other tracked types', () => {
    const html = anomalyMsg(41, LOOT);
    const raw = extract(html)[0]?.raw ?? {};
    expect(Object.keys(raw).filter((k) => k.startsWith('x-'))).toEqual([]);
  });
});

describe('extraction details', () => {
  it('keeps duplicate msgIds of one extraction once', async () => {
    consented();
    const { win } = setup();
    document.body.innerHTML = `<div id="x">${FIXTURE}${FIXTURE}</div>`;
    main(gm, document, win);
    expect(createQueue(gm).size()).toBe(2);
  });
});

describe('collector wiring', () => {
  it('enqueues the initial page content once, even if re-delivered', () => {
    consented();
    const { win, handlers } = setup({ contentHtml: [FIXTURE] });
    main(gm, document, win);
    expect(createQueue(gm).size()).toBe(2);
    const ajax = {
      url: '/game/index.php?page=componentOnly&component=messages&action=getMessagesList',
    };
    handlers[0]?.({}, {}, ajax);
    expect(createQueue(gm).size()).toBe(2);
  });

  it('ignores other urls and showTrash=true', () => {
    consented();
    const { win, handlers } = setup({ contentHtml: [FIXTURE.replaceAll('100', '200')] });
    document.body.innerHTML = '';
    main(gm, document, win);
    expect(createQueue(gm).size()).toBe(0);
    for (const settings of [
      { url: '/game/index.php?page=ingame&component=overview' },
      { url: '/x?action=getMessagesList&showTrash=true' },
      { url: '/x?action=getMessagesList', data: 'activeSubTab=22&showTrash=true' },
      { url: '/x?other=action=getMessagesList' },
    ])
      handlers[0]?.({}, {}, settings);
    expect(createQueue(gm).size()).toBe(0);
    handlers[0]?.(
      {},
      {},
      { url: '/x?action=getMessagesList', data: 'activeSubTab=22&showTrash=false' },
    );
    expect(createQueue(gm).size()).toBe(2);
    expect(createQueue(gm).state().pending).toBe(2);
  });

  it('uses activeSubTab from the request body', () => {
    consented();
    const { win, handlers } = setup({ contentHtml: [FIXTURE.replaceAll('100', '300')] });
    document.body.innerHTML = '';
    main(gm, document, win);
    handlers[0]?.(
      {},
      {},
      { url: '/x?action=getMessagesList', data: 'activeSubTab=21&showTrash=false' },
    );
    const queued = gm.get<{ subtabId: number }[]>('queue', []);
    expect(queued.every((o) => o.subtabId === 21)).toBe(true);
  });

  it('makes no fetch/XHR and only reads ogame.messages.content', async () => {
    consented();
    saveSettings(gm, { serverUrl: 'https://sl.example.org', apiKey: 'k' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const xhrSpy = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const { win, handlers, reads } = setup({ contentHtml: [FIXTURE.replaceAll('100', '400')] });
    document.body.innerHTML = '';
    main(gm, document, win);
    handlers[0]?.({}, {}, { url: '/x?action=getMessagesList' });
    await flushTick();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(new Set(reads)).toEqual(new Set(['messages', 'content']));
  });

  it('flushes to our server through GM and calls onCollected after a non-empty collection', async () => {
    consented();
    saveSettings(gm, { serverUrl: 'https://sl.example.org', apiKey: 'k' });
    const { win } = setup();
    const onCollected = vi.fn();
    main(gm, document, win, onCollected);
    await flushTick();
    expect(onCollected).toHaveBeenCalledTimes(1);
    expect(gm.requests.some((r) => r.url.startsWith('https://sl.example.org'))).toBe(true);
    for (const r of gm.requests.filter((x) => x.method === 'GET')) {
      expect(r.url).toContain('/api/v1/stats');
    }
  });

  it('re-fetches stats once after a collection flush and never otherwise', async () => {
    consented();
    saveSettings(gm, { serverUrl: 'https://sl.example.org', apiKey: 'k' });
    gm.respondWith((o) =>
      o.method === 'GET'
        ? {
            status: 200,
            body: JSON.stringify({
              summary: {
                tiles: { metal: 1, crystal: 1, deuterium: 1, darkMatter: 0, artefacts: 0, msu: 1 },
                fuel: { recorded: 0, departures: 0, unknownCount: 0 },
              },
              counts: {},
              settings: {},
            }),
          }
        : { status: 200, body: JSON.stringify({ results: [] }) },
    );
    const { win, handlers } = setup({ contentHtml: [FIXTURE.replaceAll('100', '900')] });
    document.body.innerHTML = '';
    main(gm, document, win);
    await flushTick();
    const gets = () => gm.requests.filter((r) => r.method === 'GET');
    expect(gets()).toHaveLength(1);
    expect(gm.requests.filter((r) => r.method === 'POST')).toHaveLength(0);
    await flushTick();
    expect(gets()).toHaveLength(1);
    handlers[0]?.(
      {},
      {},
      { url: '/x?action=getMessagesList', data: 'activeSubTab=22&showTrash=false' },
    );
    await flushTick();
    await flushTick();
    expect(gets()).toHaveLength(2);
    const methods = gm.requests.map((r) => r.method);
    expect(methods.lastIndexOf('POST')).toBeLessThan(methods.lastIndexOf('GET'));
  });

  it('does not call onCollected or flush when nothing is extracted', async () => {
    consented();
    saveSettings(gm, { serverUrl: 'https://sl.example.org', apiKey: 'k' });
    const { win } = setup();
    document.body.innerHTML = '';
    const onCollected = vi.fn();
    main(gm, document, win, onCollected);
    await flushTick();
    expect(onCollected).not.toHaveBeenCalled();
    expect(gm.requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });

  it('installs nothing without consent', () => {
    const { win, handlers } = setup();
    main(gm, document, win);
    expect(handlers).toHaveLength(0);
    expect(createQueue(gm).size()).toBe(0);
  });

  it('installs nothing when the server offset cannot be read', () => {
    consented();
    const { win, handlers } = setup({ serverTime: undefined });
    main(gm, document, win);
    expect(handlers).toHaveLength(0);
    expect(createQueue(gm).size()).toBe(0);
  });

  it('installs nothing when the account cannot be read', () => {
    consented();
    const { win, handlers } = setup();
    document.head.innerHTML = '<meta name="ogame-universe" content="s808-en.ogame.gameforge.com">';
    main(gm, document, win);
    expect(handlers).toHaveLength(0);
  });

  it('does not enqueue once consent was withdrawn by another tab', () => {
    consented();
    const { win, handlers } = setup({ contentHtml: [FIXTURE.replaceAll('100', '500')] });
    document.body.innerHTML = '';
    main(gm, document, win);
    saveSettings(gm, { consent: false });
    handlers[0]?.({}, {}, { url: '/x?action=getMessagesList' });
    expect(createQueue(gm).size()).toBe(0);
  });
});

describe('robustness', () => {
  const ajax = { url: '/x?action=getMessagesList' };

  it('falls back to the live active tab when the body has no activeSubTab', () => {
    consented();
    const { win, handlers } = setup({ contentHtml: [FIXTURE.replaceAll('100', '600')] });
    document.body.innerHTML = '<div class="innerTabItem active" data-subtab-id="23"></div>';
    main(gm, document, win);
    handlers[0]?.({}, {}, ajax);
    const queued = gm.get<{ subtabId: number }[]>('queue', []);
    expect(queued).toHaveLength(2);
    expect(queued.every((o) => o.subtabId === 23)).toBe(true);
  });

  it('installs nothing and does not throw when the page has no $', () => {
    consented();
    const { win } = setup();
    const { $: _omit, ...noJquery } = win;
    document.body.innerHTML = '';
    expect(() => main(gm, document, noJquery)).not.toThrow();
  });

  it('never throws out of the ajax handler when our code fails', () => {
    consented();
    const { win, handlers } = setup({ contentHtml: [FIXTURE.replaceAll('100', '700')] });
    document.body.innerHTML = '';
    main(gm, document, win);
    vi.spyOn(gm, 'set').mockImplementation(() => {
      throw new Error('storage down');
    });
    expect(() => handlers[0]?.({}, {}, ajax)).not.toThrow();
  });

  it('never throws when onCollected throws, and still flushes at page load', async () => {
    consented();
    saveSettings(gm, { serverUrl: 'https://sl.example.org', apiKey: 'k' });
    const { win, handlers } = setup({ contentHtml: [FIXTURE.replaceAll('100', '800')] });
    const onCollected = () => {
      throw new Error('hook');
    };
    expect(() => main(gm, document, win, onCollected)).not.toThrow();
    await flushTick();
    expect(gm.requests.some((r) => r.url.startsWith('https://sl.example.org'))).toBe(true);
    document.body.innerHTML = '';
    expect(() => handlers[0]?.({}, {}, ajax)).not.toThrow();
  });
});
