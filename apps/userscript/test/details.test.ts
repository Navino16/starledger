import type { AccountRef, StatsResponse } from '@app/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayKey } from '../src/env/page';
import { type MemoryGm, memoryGm } from '../src/gm';
import { createT } from '../src/i18n';
import { saveSettings } from '../src/storage';
import { createQueue } from '../src/sync/queue';
import { DETAILS_ID, openDetails } from '../src/ui/details';
import { BACKDROP_CLASS } from '../src/ui/panel';

const ACCOUNT: AccountRef = { serverId: 808, lang: 'en', playerId: 42, playerName: 'Neo' };
const t = createT('en');
const res = (metal: number, crystal: number, deuterium: number) => ({ metal, crystal, deuterium });

const statsOf = (
  patch: { unrecognized?: number; conflictCount?: number; ignoreConsumption?: boolean } = {},
): StatsResponse =>
  ({
    period: 'day',
    range: null,
    generatedAt: 1,
    counts: { unrecognized: patch.unrecognized ?? 0 },
    settings: { ignoreConsumption: patch.ignoreConsumption ?? false },
    summary: {
      tiles: { metal: 990, crystal: 1980, deuterium: 2193, darkMatter: 0, artefacts: 0, msu: 4000 },
      discoveries: { count: 4, xpByLifeform: { '1': 100, '2': 50 }, artefacts: 2 },
      combats: { shipsLost: { '204': 9 } },
      conflictCount: patch.conflictCount ?? 0,
      fuel: { recorded: 777, departures: 3, unknownCount: 0 },
      expeditions: {
        outcomes: { resources: 3, nothing: 1, ships: 0 },
        shipsFound: { '202': 5 },
        shipsLost: { '202': 2, '203': 1 },
      },
      balance: {
        expeditions: { gains: res(1000, 2000, 3000), losses: res(10, 20, 30) },
        combats: { gains: res(0, 0, 0), losses: res(0, 0, 0) },
        recycling: { gains: res(0, 0, 0), losses: res(0, 0, 0) },
        wreckfields: { gains: res(0, 0, 0), losses: res(0, 0, 0) },
        fuel: { gains: res(0, 0, 0), losses: res(0, 0, 777) },
      },
    },
  }) as unknown as StatsResponse;

describe('stats details dialog', () => {
  let gm: MemoryGm;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const open = () =>
    openDetails(
      { gm, doc: document, t, queue: createQueue(gm) },
      { account: ACCOUNT, serverUtcOffsetMinutes: 0 },
    );
  const dialog = () => document.getElementById(DETAILS_ID);
  const stats = () => gm.requests.filter((r) => r.url.includes('/api/v1/stats'));

  beforeEach(() => {
    gm = memoryGm();
    document.body.innerHTML = '<div id="links"></div><div id="footer"></div>';
    saveSettings(gm, { consent: true, serverUrl: 'https://sl.example.org', apiKey: 'k' });
    gm.respondWith(() => ({ status: 200, body: JSON.stringify(statsOf()) }));
  });

  it('requests the day on open and the week on click with the right today', async () => {
    open();
    await tick();
    expect(stats()).toHaveLength(1);
    expect(stats()[0]?.url).toContain('period=day');
    dialog()?.querySelector<HTMLElement>('[data-period="week"]')?.click();
    await tick();
    expect(stats()).toHaveLength(2);
    expect(stats()[1]?.url).toContain(`period=week&today=${todayKey(0)}`);
  });

  it('shows outcome percentages, ships by id and a separate gains/losses/fuel table', async () => {
    open();
    await tick();
    const text = dialog()?.textContent ?? '';
    expect(text).toContain('Resources: 3 (75%)');
    expect(text).toContain('Nothing: 1 (25%)');
    expect(text).not.toContain('Ships:');
    const shipRows = [...(dialog()?.querySelectorAll('.starledger-ships tr') ?? [])].map(
      (r) => r.textContent,
    );
    expect(shipRows).toContain('20252');
    expect(shipRows).toContain('20301');
    expect(shipRows).toContain('20409');
    const heads = [...(dialog()?.querySelectorAll('.starledger-balance th') ?? [])].map(
      (h) => h.textContent,
    );
    expect(heads).toEqual(['Category', 'Gains', 'Losses', 'Fuel']);
    const exp = dialog()?.querySelectorAll('[data-category="expeditions"] td');
    expect(exp?.[1]?.textContent).toContain('M 1k');
    expect(exp?.[2]?.textContent).toContain('M 10');
    const amounts = [...(exp?.[1]?.querySelectorAll('.starledger-amount') ?? [])];
    expect(amounts.map((a) => (a as HTMLElement).dataset.res)).toEqual([
      'metal',
      'crystal',
      'deuterium',
    ]);
    expect(dialog()?.querySelector('[data-category="net"] [data-res="msu"]')).not.toBeNull();
    expect(dialog()?.querySelector('[data-category="fuel"] td:nth-child(4)')?.textContent).toBe(
      '777',
    );
    expect(text).toContain(t('balanceScope'));
    const disc = dialog()?.querySelector('[data-category="discoveries"]');
    expect(disc?.textContent).toContain('4 discoveries · XP 150 · Artefacts 2');
    expect(disc?.querySelectorAll('td')[2]?.textContent).toBe('-');
    const net = dialog()?.querySelector('[data-category="net"]')?.textContent ?? '';
    expect(net).toContain('M 990');
    expect(net).toContain('MSU 4k');
  });

  it('shows unrecognized and conflict lines only when above 0', async () => {
    open();
    await tick();
    expect(dialog()?.textContent).not.toContain('unrecognized');
    expect(dialog()?.textContent).not.toContain('conflicts');
    gm.respondWith(() => ({
      status: 200,
      body: JSON.stringify(statsOf({ unrecognized: 3, conflictCount: 2 })),
    }));
    dialog()?.querySelector<HTMLElement>('[data-period="all"]')?.click();
    await tick();
    expect(dialog()?.textContent).toContain('3 unrecognized reports');
    expect(dialog()?.textContent).toContain('2 conflicts');
  });

  it('opens in a backdrop at the end of the body and leaves the page as before on close', async () => {
    document.body.innerHTML =
      '<div id="links"></div><div id="contentWrapper"><p>game</p></div><div id="footer"></div>';
    const initial = document.body.innerHTML;
    open();
    const backdrop = dialog()?.parentElement;
    expect(backdrop?.className).toBe(BACKDROP_CLASS);
    expect(document.body.lastElementChild).toBe(backdrop);
    [...(dialog()?.querySelectorAll('button') ?? [])]
      .find((b) => b.textContent === 'Close')
      ?.click();
    await tick();
    expect(document.body.innerHTML).toBe(initial);
  });

  it('closes on Escape, click outside and the close button, but not on a click inside', async () => {
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog()).toBeNull();
    open();
    document.querySelector<HTMLElement>(`.${BACKDROP_CLASS}`)?.click();
    expect(dialog()).toBeNull();
    open();
    dialog()?.querySelector('strong')?.click();
    expect(dialog()).not.toBeNull();
    [...(dialog()?.querySelectorAll('button') ?? [])]
      .find((b) => b.textContent === 'Close')
      ?.click();
    expect(dialog()).toBeNull();
    await tick();
    expect(document.body.innerHTML).toBe('<div id="links"></div><div id="footer"></div>');
  });

  it('leaves no listener behind after reopening and closing, and restores focus', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    open();
    expect(document.activeElement?.textContent).toBe('Close');
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await tick();
    const added = add.mock.calls.filter(([n]) => n === 'keydown' || n === 'click').length;
    const removed = remove.mock.calls.filter(([n]) => n === 'keydown' || n === 'click').length;
    expect(removed).toBe(added);
    add.mockRestore();
    remove.mockRestore();
  });

  it('flushes the queue before the first stats request when the detail opens', async () => {
    const queue = createQueue(gm);
    queue.enqueue([
      { kind: 'page_view', serverId: 808, lang: 'en', playerId: 42, ts: 1, page: 'overview' },
    ] as never);
    gm.respondWith((o) =>
      o.method === 'POST'
        ? { status: 200, body: JSON.stringify({ results: [] }) }
        : { status: 200, body: JSON.stringify(statsOf()) },
    );
    openDetails({ gm, doc: document, t, queue }, { account: ACCOUNT, serverUtcOffsetMinutes: 0 });
    expect(dialog()?.textContent).toContain('Loading...');
    await tick();
    await tick();
    const kinds = gm.requests.map((r) => r.method);
    expect(kinds[0]).toBe('POST');
    expect(kinds.indexOf('GET')).toBeGreaterThan(kinds.indexOf('POST'));
  });

  it('uses singular forms and notes ignored consumption', async () => {
    gm.respondWith(() => ({
      status: 200,
      body: JSON.stringify(statsOf({ unrecognized: 1, conflictCount: 1, ignoreConsumption: true })),
    }));
    open();
    await tick();
    const text = dialog()?.textContent ?? '';
    expect(text).toContain('1 unrecognized report');
    expect(text).not.toContain('1 unrecognized reports');
    expect(text).toContain('1 conflict');
    expect(text).not.toContain('1 conflicts');
    expect(text).toContain('777 (ignored)');
    expect(text).toContain(t('balanceScopeNoFuel'));
  });

  it('shows nothing from a response that arrives after consent was withdrawn', async () => {
    const pending: ((v: { status: number; body: string }) => void)[] = [];
    gm.respondWith(() => new Promise((r) => pending.push(r)));
    open();
    await tick();
    saveSettings(gm, { consent: false });
    pending[0]?.({ status: 200, body: JSON.stringify(statsOf({ unrecognized: 5 })) });
    await tick();
    expect(dialog()?.textContent).not.toContain('5 unrecognized');
  });

  it('shows the translated error and handles a missing configuration without requesting', async () => {
    gm.respondWith(() => ({ status: 401, body: '' }));
    open();
    await tick();
    expect(dialog()?.textContent).toContain('Invalid key');
    saveSettings(gm, { consent: false });
    const before = gm.requests.length;
    dialog()?.querySelector<HTMLElement>('[data-period="month"]')?.click();
    await tick();
    expect(gm.requests).toHaveLength(before);
    expect(dialog()?.textContent).toContain('Server URL or key missing');
  });

  it('ignores a response arriving after a newer period or after close', async () => {
    const pending: ((v: { status: number; body: string }) => void)[] = [];
    gm.respondWith(() => new Promise((r) => pending.push(r)));
    open();
    await tick();
    dialog()?.querySelector<HTMLElement>('[data-period="week"]')?.click();
    await tick();
    pending[1]?.({ status: 200, body: JSON.stringify(statsOf({ unrecognized: 7 })) });
    await tick();
    pending[0]?.({ status: 200, body: JSON.stringify(statsOf({ unrecognized: 1 })) });
    await tick();
    expect(dialog()?.textContent).toContain('7 unrecognized');
    expect(dialog()?.textContent).not.toContain('1 unrecognized');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog()).toBeNull();
  });
});
