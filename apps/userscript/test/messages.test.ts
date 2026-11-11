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
    document,
    serverTime: 'serverTime' in opts ? opts.serverTime : new Date(),
    ogame,
    $: () => ({ on: (_e: string, h: Handler) => handlers.push(h) }),
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

describe('collector wiring', () => {
  const consented = () => saveSettings(gm, { consent: true });

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
    expect(gm.requests).toHaveLength(0);
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
