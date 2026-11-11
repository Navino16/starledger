import type { AccountRef, StatsResponse } from '@app/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/app';
import { memoryGm } from '../src/gm';
import { createT, MESSAGES } from '../src/i18n';
import { loadStatsCache, saveSettings, saveStatsCache } from '../src/storage';
import type { SyncState } from '../src/sync/queue';
import { type BoxModel, renderBox } from '../src/ui/box';
import { mountBox } from '../src/ui/dom';
import { formatAmount, formatTime } from '../src/ui/format';

const ACCOUNT: AccountRef = { serverId: 808, lang: 'en', playerId: 42, playerName: 'Neo' };

const statsOf = (patch: Partial<StatsResponse['summary']['fuel']> = {}): StatsResponse =>
  ({
    period: 'day',
    range: null,
    generatedAt: 1,
    counts: { unrecognized: 0 },
    settings: {},
    summary: {
      tiles: {
        metal: 1500000,
        crystal: 2500,
        deuterium: -300,
        darkMatter: 0,
        artefacts: 3,
        msu: 999999,
      },
      fuel: { recorded: 12000, departures: 5, unknownCount: 0, ...patch },
      conflictCount: 0,
    },
  }) as unknown as StatsResponse;

const state = (patch: Partial<SyncState> = {}): SyncState => ({
  status: 'up_to_date',
  pending: 0,
  lastSyncAt: null,
  error: null,
  rejected: 0,
  ...patch,
});

const model = (patch: Partial<BoxModel> = {}): BoxModel => ({
  state: state(),
  stats: statsOf(),
  statsAt: Date.UTC(2026, 10, 11, 12, 34),
  stale: false,
  configured: true,
  consent: true,
  ...patch,
});

const t = createT('en');
const render = (m: BoxModel, handlers = { onConfigure: vi.fn(), onOpenDetails: vi.fn() }) => {
  const box = document.createElement('div');
  renderBox(box, m, { t, ...handlers });
  return { box, ...handlers };
};
const tile = (box: HTMLElement, name: string) =>
  box.querySelector(`[data-tile="${name}"] .starledger-value`)?.textContent;

describe('formatAmount', () => {
  it('formats unknown, small, k, M and G amounts', () => {
    expect(formatAmount(null)).toBe('?');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(999)).toBe('999');
    expect(formatAmount(1000)).toBe('1k');
    expect(formatAmount(1500)).toBe('1.5k');
    expect(formatAmount(1500000)).toBe('1.5M');
    expect(formatAmount(2_000_000_000)).toBe('2G');
    expect(formatAmount(1_234_000_000_000)).toBe('1234G');
  });

  it('rounds to one decimal and promotes the unit instead of showing 1000k', () => {
    expect(formatAmount(1249)).toBe('1.2k');
    expect(formatAmount(999_999)).toBe('1M');
    expect(formatAmount(999.6)).toBe('1k');
  });

  it('keeps the sign for losses and never prints -0', () => {
    expect(formatAmount(-1500000)).toBe('-1.5M');
    expect(formatAmount(-300)).toBe('-300');
    expect(formatAmount(-0.2)).toBe('0');
  });

  it('shows ? for non-finite values', () => {
    expect(formatAmount(Number.NaN)).toBe('?');
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe('?');
  });
});

describe('renderBox', () => {
  it('renders the six tiles', () => {
    const { box } = render(model());
    expect(tile(box, 'metal')).toBe('1.5M');
    expect(tile(box, 'crystal')).toBe('2.5k');
    expect(tile(box, 'deuterium')).toBe('-300');
    expect(tile(box, 'darkMatter')).toBe('0');
    expect(tile(box, 'artefacts')).toBe('3');
    expect(tile(box, 'msu')).toBe('1M');
  });

  it('shows ? tiles without stats', () => {
    const { box } = render(model({ stats: null, statsAt: null }));
    expect(tile(box, 'metal')).toBe('?');
    expect(tile(box, 'fuel')).toBe('?');
  });

  it('shows the fuel amount when every departure has a known consumption', () => {
    expect(tile(render(model()).box, 'fuel')).toBe('12k');
  });

  it('shows ? and the unknown departures for fuel, never 0', () => {
    const { box } = render(model({ stats: statsOf({ recorded: 0, unknownCount: 2 }) }));
    expect(tile(box, 'fuel')).toBe('? (2)');
  });

  it('marks cached figures as old with their time', () => {
    const { box } = render(model({ stale: true }));
    expect(box.textContent).toContain(t('stale'));
    expect(render(model()).box.textContent).not.toContain(t('stale'));
  });

  it('shows pending count, up-to-date time and the translated error', () => {
    expect(
      render(model({ state: state({ status: 'pending', pending: 4 }) })).box.textContent,
    ).toContain('4 pending');
    const synced = state({ lastSyncAt: Date.UTC(2026, 10, 11, 8, 5) });
    expect(render(model({ state: synced })).box.textContent).toContain(
      t('statusUpToDate', { time: formatTime(synced.lastSyncAt as number) }),
    );
    const failing = state({ status: 'error', error: 'unreachable' });
    expect(render(model({ state: failing })).box.textContent).toContain('Server unreachable');
  });

  it('colours the status dot by sync state', () => {
    const dot = (m: BoxModel) => render(m).box.querySelector('.starledger-dot');
    expect(dot(model())?.classList.contains('is-ok')).toBe(true);
    expect(dot(model({ state: state({ status: 'pending', pending: 2 }) }))?.classList).toContain(
      'is-pending',
    );
    const failing = dot(model({ state: state({ status: 'error', error: 'unreachable' }) }));
    expect(failing?.classList).toContain('is-error');
    expect(failing?.getAttribute('title')).toBe('Server unreachable');
  });

  it('marks cached figures as stale', () => {
    expect(render(model({ stale: true })).box.querySelector('.starledger-stale')).not.toBeNull();
    expect(render(model()).box.querySelector('.starledger-stale')).toBeNull();
  });

  it('labels the CTA in both languages', () => {
    expect(MESSAGES.en.configureSync).toBe('⚙ Configure sync');
    expect(MESSAGES.fr.configureSync).toBe('⚙ Configurer la synchro');
    expect(
      render(model({ consent: false })).box.querySelector('.starledger-cta')?.textContent,
    ).toBe(t('configureSync'));
  });

  it('shows the stats error next to cached figures', () => {
    const { box } = render(model({ stale: true, statsError: 'invalid_key' }));
    expect(box.textContent).toContain('Invalid key');
  });

  it('opens the detail on click and keeps tiles as plain text', () => {
    const { box, onOpenDetails } = render(model());
    (box.querySelector('.starledger-tiles') as HTMLElement).click();
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
    expect(box.querySelector('script, img')).toBeNull();
  });

  it('shows the consent CTA without consent', () => {
    const { box, onConfigure } = render(model({ consent: false, stats: null }));
    const buttons = box.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    buttons[0]?.click();
    expect(onConfigure).toHaveBeenCalledTimes(1);
    expect(box.querySelector('[data-tile]')).toBeNull();
  });

  it('shows the server CTA when consent is given but the server is not configured', () => {
    const { box, onConfigure } = render(model({ configured: false, stats: null }));
    expect(box.textContent).toContain(t('configureSync'));
    box.querySelector('button')?.click();
    expect(onConfigure).toHaveBeenCalledTimes(1);
    expect(box.querySelector('[data-tile]')).toBeNull();
  });

  it('has a French translation', () => {
    const box = document.createElement('div');
    renderBox(box, model({ stale: true }), {
      t: createT('fr'),
      onConfigure: () => {},
      onOpenDetails: () => {},
    });
    expect(box.textContent).toContain(MESSAGES.fr.stale);
  });
});

describe('stats cache', () => {
  it('round-trips per account', () => {
    const gm = memoryGm();
    saveStatsCache(gm, ACCOUNT, statsOf(), 123);
    expect(loadStatsCache(gm, ACCOUNT)).toMatchObject({ at: 123 });
    expect(loadStatsCache(gm, { ...ACCOUNT, playerId: 43 })).toBeNull();
  });

  it.each([
    ['a string', 'x'],
    ['null', null],
    ['no stats', { at: 1 }],
    ['a bad time', { at: 'x', stats: statsOf() }],
    ['no tiles', { at: 1, stats: { summary: { fuel: {} } } }],
    ['a non-numeric tile', { at: 1, stats: { summary: { tiles: { metal: 'x' }, fuel: {} } } }],
  ])('ignores a malformed entry (%s)', (_name, value) => {
    const gm = memoryGm();
    gm.set('statsCache.808-en-42', value);
    expect(loadStatsCache(gm, ACCOUNT)).toBeNull();
  });
});

describe('box in the page', () => {
  const MENU =
    '<table id="menuTable"><tbody><tr><td>a</td></tr><tr><td>shop</td></tr></tbody></table>';
  let gm: ReturnType<typeof memoryGm>;
  const win = { serverTime: new Date(), $: undefined } as never;

  beforeEach(() => {
    gm = memoryGm();
    document.head.innerHTML =
      '<meta name="ogame-universe" content="s808-en.ogame.gameforge.com"><meta name="ogame-language" content="en"><meta name="ogame-player-id" content="42"><meta name="ogame-player-name" content="Neo">';
    document.body.innerHTML = `<div id="links">${MENU}</div><div id="footer"></div>`;
    delete (globalThis as { $?: unknown }).$;
  });

  const statsRequests = () => gm.requests.filter((r) => r.url.includes('/api/v1/stats'));
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('is inserted inside #links without touching #menuTable', () => {
    const before = [...document.querySelectorAll('#menuTable *')];
    saveSettings(gm, { consent: true });
    main(gm, document, win);
    expect(document.getElementById('links')?.lastElementChild?.id).toBe('starledger-box');
    expect([...document.querySelectorAll('#menuTable *')]).toEqual(before);
    expect(document.getElementById('menuTable')?.parentElement?.id).toBe('links');
  });

  describe('after third-party panels', () => {
    const OGL = '<div class="ogl_miniStats"></div>';
    const ids = () =>
      [...(document.getElementById('links')?.children ?? [])].map((c) => c.id || c.className);
    const links = () => document.getElementById('links') as HTMLElement;

    it('is the last child of #links with the menu untouched', () => {
      links().insertAdjacentHTML('beforeend', '<div id="toolLinksWrapper"></div>');
      const before = [...document.querySelectorAll('#menuTable *')];
      saveSettings(gm, { consent: true });
      main(gm, document, win);
      expect(ids()).toEqual(['menuTable', 'toolLinksWrapper', 'starledger-box']);
      expect([...document.querySelectorAll('#menuTable *')]).toEqual(before);
    });

    it('goes after every panel present at mount', () => {
      links().insertAdjacentHTML('beforeend', `${OGL}<div class="other"></div>`);
      saveSettings(gm, { consent: true });
      main(gm, document, win);
      expect(ids()).toEqual(['menuTable', 'ogl_miniStats', 'other', 'starledger-box']);
    });

    it('moves back to last when a panel is added after the mount', async () => {
      saveSettings(gm, { consent: true });
      main(gm, document, win);
      links().insertAdjacentHTML('beforeend', OGL);
      await Promise.resolve();
      expect(ids()).toEqual(['menuTable', 'ogl_miniStats', 'starledger-box']);
    });

    it('stops after 5 moves against a tool that insists on being last', async () => {
      saveSettings(gm, { consent: true });
      main(gm, document, win);
      const hostile = document.createElement('div');
      hostile.className = 'hostile';
      let boxMoves = 0;
      const obs = new MutationObserver((records) => {
        for (const r of records) {
          for (const n of r.addedNodes) if ((n as Element).id === 'starledger-box') boxMoves++;
        }
        if (links().lastElementChild !== hostile) links().append(hostile);
      });
      obs.observe(links(), { childList: true });
      links().append(hostile);
      for (let i = 0; i < 40; i++) await Promise.resolve();
      obs.disconnect();
      expect(boxMoves).toBeLessThanOrEqual(5);
      expect(boxMoves).toBeGreaterThan(0);
      expect(ids().at(-1)).toBe('hostile');
    });

    it('keeps the placement on re-mount with a single observer', () => {
      const Real = MutationObserver;
      const ctor = vi.fn();
      class Spy extends Real {
        constructor(cb: MutationCallback) {
          super(cb);
          ctor();
        }
      }
      vi.stubGlobal('MutationObserver', Spy);
      try {
        links().insertAdjacentHTML('beforeend', OGL);
        mountBox(document, document.createElement('div'));
        mountBox(document, document.createElement('div'));
        expect(ids()).toEqual(['menuTable', 'ogl_miniStats', 'starledger-box']);
        expect(ctor).toHaveBeenCalledTimes(1);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  it('shows the server CTA and requests nothing when the server is not configured', async () => {
    saveSettings(gm, { consent: true });
    main(gm, document, win);
    await tick();
    expect(document.getElementById('starledger-box')?.textContent).toContain(t('configureSync'));
    expect(gm.requests).toHaveLength(0);
  });

  it('fetches today stats once after the page-load flush and caches them', async () => {
    saveSettings(gm, { consent: true, serverUrl: 'https://sl.example.org', apiKey: 'k' });
    gm.respondWith(() => ({ status: 200, body: JSON.stringify(statsOf()) }));
    main(gm, document, win);
    await tick();
    await tick();
    expect(statsRequests()).toHaveLength(1);
    expect(statsRequests()[0]?.url).toMatch(
      /serverId=808&lang=en&playerId=42&period=day&today=\d{4}-\d{2}-\d{2}/,
    );
    expect(document.querySelector('[data-tile="metal"] .starledger-value')?.textContent).toBe(
      '1.5M',
    );
    expect(document.getElementById('starledger-box')?.textContent).not.toContain(t('stale'));
    expect(loadStatsCache(gm, ACCOUNT)).not.toBeNull();
  });

  it('shows cached stats as old plus the error when the server fails', async () => {
    saveSettings(gm, { consent: true, serverUrl: 'https://sl.example.org', apiKey: 'k' });
    saveStatsCache(gm, ACCOUNT, statsOf(), Date.UTC(2026, 10, 10, 9, 0));
    gm.respondWith(() => ({ status: 401, body: '' }));
    main(gm, document, win);
    await tick();
    await tick();
    const text = document.getElementById('starledger-box')?.textContent ?? '';
    expect(text).toContain(t('stale'));
    expect(text).toContain('Invalid key');
    expect(document.querySelector('[data-tile="metal"] .starledger-value')?.textContent).toBe(
      '1.5M',
    );
  });

  it('shows ? and requests no stats when the account is unknown', async () => {
    document.head.innerHTML =
      '<meta name="ogame-universe" content="s808-en.ogame.gameforge.com"><meta name="ogame-language" content="en">';
    saveSettings(gm, { consent: true, serverUrl: 'https://sl.example.org', apiKey: 'k' });
    main(gm, document, win);
    await tick();
    expect(statsRequests()).toHaveLength(0);
    expect(document.querySelector('[data-tile="metal"] .starledger-value')?.textContent).toBe('?');
  });

  it('shows ? and requests no stats when the server offset is unknown', async () => {
    saveSettings(gm, { consent: true, serverUrl: 'https://sl.example.org', apiKey: 'k' });
    main(gm, document, { serverTime: undefined } as never);
    await tick();
    expect(statsRequests()).toHaveLength(0);
    expect(document.querySelector('[data-tile="metal"] .starledger-value')?.textContent).toBe('?');
  });

  it('keeps using no timers', () => {
    const spies = [vi.spyOn(globalThis, 'setInterval'), vi.spyOn(globalThis, 'setTimeout')];
    saveSettings(gm, { consent: true });
    main(gm, document, win);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
  });
});
