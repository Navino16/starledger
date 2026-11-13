import type { AccountRef, StatsResponse } from '@app/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  patch: {
    unrecognized?: number;
    conflictCount?: number;
    ignoreConsumption?: boolean;
    includeTrades?: boolean;
    noTrades?: boolean;
  } = {},
): StatsResponse =>
  ({
    period: 'day',
    range: null,
    generatedAt: 1,
    counts: { unrecognized: patch.unrecognized ?? 0 },
    settings: {
      ignoreConsumption: patch.ignoreConsumption ?? false,
      includeTradesInBalance: patch.includeTrades ?? false,
    },
    summary: {
      ...(patch.noTrades
        ? {}
        : {
            trades: {
              received: res(500, 300, 100),
              delivered: res(200, 400, 100),
              receivedCount: 3,
              deliveredCount: 1,
            },
          }),
      rows: Object.fromEntries(
        [
          'expeditions',
          'combats',
          'recycling',
          'wreckfields',
          'anomalies',
          'discoveries',
          'fuel',
          'trades',
          'total',
        ].map((k) => [
          k,
          {
            count: 1,
            resources: res(1, 1, k === 'fuel' ? -777 : 1),
            msu: k === 'total' ? 4000 : 1,
            darkMatter: null,
            artefacts: null,
            lithium: null,
            unknown: k === 'fuel' ? 2 : 0,
          },
        ]),
      ),
      tiles: { metal: 990, crystal: 1980, deuterium: 2193, darkMatter: 0, artefacts: 0, msu: 4000 },
      discoveries: { count: 4, xpByLifeform: { '1': 100, '2': 50 }, artefacts: 2 },
      combats: { shipsLost: { '204': 9 } },
      conflictCount: patch.conflictCount ?? 0,
      fuel: { recorded: 777, departures: 3, unknownCount: 0 },
      anomalies: {
        combats: { count: 2 },
        rewards: { count: 3 },
        lithium: {
          spent: 1200,
          refunded: 200,
          net: -1000,
          spentUnknown: 0,
          refundUnknown: 0,
          darkMatterUnknown: 0,
          darkMatterSpent: 0,
          scans: 6,
          collects: 4,
        },
      },
      ships: { found: { '202': 5 }, lost: { '202': 2, '203': 1 } },
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
        anomalies: { gains: res(40, 30, 20), losses: res(5, 4, 3) },
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
  const hints = () =>
    [...(dialog()?.querySelectorAll<HTMLElement>('tr[data-category]') ?? [])]
      .map((tr) => tr.title)
      .join('\n');
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

  it('shows outcome percentages, ships by id and the balance table with its notes', async () => {
    open();
    await tick();
    const legend = (key: string) => dialog()?.querySelector(`[data-legend="${key}"]`)?.textContent;
    expect(legend('resources')).toBe('Resources375.0%');
    expect(legend('nothing')).toBe('Nothing125.0%');
    const longDate = new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${todayKey(0)}T00:00:00Z`));
    expect(dialog()?.querySelector('.starledger-dateline')?.textContent).toBe(longDate);
    expect(dialog()?.querySelector('[data-ship="202"] .starledger-found')?.textContent).toBe('5');
    expect(dialog()?.querySelector('[data-ship="202"] .starledger-lost')?.textContent).toBe('-2');
    expect(dialog()?.querySelectorAll('.starledger-balance tr[data-category]')).toHaveLength(9);
    expect(dialog()?.querySelector('[data-category="total"] [data-col="msu"]')?.textContent).toBe(
      '4.0k + ? (2)',
    );
    expect(
      dialog()?.querySelector('[data-category="fuel"] [data-col="deuterium"]')?.textContent,
    ).toBe('-777 + ? (2)');
    expect(dialog()?.querySelector<HTMLElement>('[data-category="discoveries"]')?.title).toContain(
      'XP 150',
    );
    expect(dialog()?.querySelector('.starledger-notes')).toBeNull();
  });

  it('shows ? cells when an older server sends no rows', async () => {
    const body = statsOf();
    delete (body.summary as Partial<typeof body.summary>).rows;
    gm.respondWith(() => ({ status: 200, body: JSON.stringify(body) }));
    open();
    await tick();
    expect(
      dialog()?.querySelector('[data-category="expeditions"] [data-col="metal"]')?.textContent,
    ).toBe('?');
  });

  it('puts unrecognized and conflict counts in the total row tooltip only when above 0', async () => {
    open();
    await tick();
    expect(hints()).not.toContain('unrecognized');
    expect(hints()).not.toContain('conflicts');
    gm.respondWith(() => ({
      status: 200,
      body: JSON.stringify(statsOf({ unrecognized: 3, conflictCount: 2 })),
    }));
    dialog()?.querySelector<HTMLElement>('[data-period="all"]')?.click();
    await tick();
    const total = dialog()?.querySelector<HTMLElement>('[data-category="total"]')?.title;
    expect(total).toContain('3 unrecognized reports');
    expect(total).toContain('2 conflicts');
    expect(dialog()?.textContent).not.toContain('unrecognized');
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

  it('uses singular forms and hints ignored consumption on the fuel row', async () => {
    gm.respondWith(() => ({
      status: 200,
      body: JSON.stringify(statsOf({ unrecognized: 1, conflictCount: 1, ignoreConsumption: true })),
    }));
    open();
    await tick();
    const text = hints();
    expect(text).toContain('1 unrecognized report');
    expect(text).not.toContain('1 unrecognized reports');
    expect(text).toContain('1 conflict');
    expect(text).not.toContain('1 conflicts');
    expect(dialog()?.querySelector<HTMLElement>('[data-category="fuel"]')?.title).toContain(
      t('fuelIgnoredNote'),
    );
  });

  it('shows nothing from a response that arrives after consent was withdrawn', async () => {
    const pending: ((v: { status: number; body: string }) => void)[] = [];
    gm.respondWith(() => new Promise((r) => pending.push(r)));
    open();
    await tick();
    saveSettings(gm, { consent: false });
    pending[0]?.({ status: 200, body: JSON.stringify(statsOf({ unrecognized: 5 })) });
    await tick();
    expect(hints()).not.toContain('5 unrecognized');
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
    expect(hints()).toContain('7 unrecognized');
    expect(hints()).not.toContain('1 unrecognized');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog()).toBeNull();
  });
});

describe('details period navigation', () => {
  let gm: MemoryGm;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const dialog = () => document.getElementById(DETAILS_ID);
  const stats = () => gm.requests.filter((r) => r.url.includes('/api/v1/stats'));
  const open = () =>
    openDetails(
      { gm, doc: document, t, queue: createQueue(gm) },
      { account: ACCOUNT, serverUtcOffsetMinutes: 0 },
    );
  const days = (month: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      day: `${month}-${String(i + 1).padStart(2, '0')}`,
      msu: 1,
    }));

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));
    gm = memoryGm();
    document.body.innerHTML = '<div id="links"></div><div id="footer"></div>';
    saveSettings(gm, { consent: true, serverUrl: 'https://sl.example.org', apiKey: 'k' });
    gm.respondWith((req) => ({
      status: 200,
      body: JSON.stringify({
        ...statsOf(),
        days: days(
          req.url.includes('today=2026-02') ? '2026-02' : '2026-03',
          req.url.includes('today=2026-02') ? 28 : 31,
        ),
      }),
    }));
  });

  afterEach(() => vi.useRealTimers());

  it('sends the previous month clamped to its last day', async () => {
    open();
    await tick();
    dialog()?.querySelector<HTMLElement>('[data-nav="prev"]')?.click();
    await tick();
    expect(stats()).toHaveLength(2);
    expect(stats()[1]?.url).toContain('today=2026-02-28');
    expect(dialog()?.querySelectorAll('[data-day]')).toHaveLength(28);
  });

  describe('custom period', () => {
    const cal = () => dialog()?.querySelector<HTMLElement>('.starledger-calendar');
    const cell = (day: string) => dialog()?.querySelector(`[data-day="${day}"]`) ?? null;
    const pointer = (type: string, under: Element | null) => {
      document.elementFromPoint = () => under;
      (type === 'pointerdown' ? under : cal())?.dispatchEvent(
        new PointerEvent(type, { bubbles: true, isPrimary: true, button: 0, pointerId: 1 }),
      );
    };
    const drag = (from: string, to: string) => {
      pointer('pointerdown', cell(from));
      pointer('pointermove', cell(to));
      pointer('pointerup', cell(to));
    };

    beforeEach(() => {
      gm.respondWith((req) => {
        const params = new URL(req.url).searchParams;
        const from = params.get('from');
        const to = params.get('to');
        return {
          status: 200,
          body: JSON.stringify({
            ...statsOf(),
            period: params.get('period'),
            range: from && to ? { from, to } : null,
            days: days('2026-03', 31),
          }),
        };
      });
    });

    afterEach(() => Reflect.deleteProperty(document, 'elementFromPoint'));

    it('requests the dragged span once and labels it', async () => {
      open();
      await tick();
      drag('2026-03-04', '2026-03-11');
      await tick();
      expect(stats()).toHaveLength(2);
      expect(stats()[1]?.url).toContain(
        'period=custom&today=2026-03-31&from=2026-03-04&to=2026-03-11',
      );
      const label = new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).formatRange(new Date('2026-03-04T00:00:00Z'), new Date('2026-03-11T00:00:00Z'));
      expect(dialog()?.querySelector('.starledger-dateline')?.textContent).toBe(label);
      expect(dialog()?.querySelector('.starledger-periods [aria-pressed="true"]')).toBeNull();
      expect(dialog()?.querySelectorAll('.is-in-period')).toHaveLength(8);
    });

    it('does not request again for the same span', async () => {
      open();
      await tick();
      drag('2026-03-04', '2026-03-11');
      await tick();
      drag('2026-03-11', '2026-03-04');
      await tick();
      expect(stats()).toHaveLength(2);
    });

    it('switches to the whole month with the arrows and to a day on click', async () => {
      open();
      await tick();
      drag('2026-03-04', '2026-03-11');
      await tick();
      dialog()?.querySelector<HTMLElement>('[data-nav="prev"]')?.click();
      await tick();
      expect(stats()[2]?.url).toContain('period=month&today=2026-02-28');
      expect(stats()[2]?.url).not.toContain('from=');
      drag('2026-03-04', '2026-03-11');
      await tick();
      dialog()?.querySelector<HTMLElement>('[data-day="2026-03-06"]')?.click();
      await tick();
      expect(stats().at(-1)?.url).toContain('period=day&today=2026-03-06');
      expect(stats().at(-1)?.url).not.toContain('from=');
    });

    it('asks to update a server that rejects custom periods', async () => {
      open();
      await tick();
      gm.respondWith(() => ({ status: 400, body: '{"error":"invalid_payload"}' }));
      drag('2026-03-04', '2026-03-11');
      await tick();
      expect(dialog()?.querySelector('.starledger-error')?.textContent).toBe(
        'Update your Starledger server to use custom periods',
      );
    });
  });

  it('shows the localized month label', async () => {
    open();
    await tick();
    expect(dialog()?.querySelector('.starledger-month')?.textContent).toBe('March 2026');
  });

  it('selects a day from the calendar', async () => {
    open();
    await tick();
    dialog()?.querySelector<HTMLElement>('[data-period="month"]')?.click();
    await tick();
    dialog()?.querySelector<HTMLElement>('[data-day="2026-03-10"]')?.click();
    await tick();
    const url = stats().at(-1)?.url ?? '';
    expect(url).toContain('period=day');
    expect(url).toContain('today=2026-03-10');
  });

  it('does not request again for the active period', async () => {
    open();
    await tick();
    dialog()?.querySelector<HTMLElement>('[data-period="day"]')?.click();
    await tick();
    expect(stats()).toHaveLength(1);
  });

  it('shows only the last response after two quick clicks', async () => {
    const pending: ((v: { status: number; body: string }) => void)[] = [];
    open();
    await tick();
    gm.respondWith(
      (req) =>
        new Promise((resolve) => {
          pending.push((v) => resolve(v));
          void req;
        }) as never,
    );
    dialog()?.querySelector<HTMLElement>('[data-nav="prev"]')?.click();
    await tick();
    dialog()?.querySelector<HTMLElement>('[data-nav="prev"]')?.click();
    await tick();
    expect(pending).toHaveLength(2);
    const body = (n: number) => JSON.stringify({ ...statsOf(), days: days('2026-01', n) });
    pending[1]?.({ status: 200, body: body(31) });
    await tick();
    pending[0]?.({ status: 200, body: body(5) });
    await tick();
    expect(dialog()?.querySelectorAll('[data-day]')).toHaveLength(31);
  });

  it('shows the month label in French', async () => {
    document.head.innerHTML = '<meta name="ogame-language" content="fr">';
    open();
    await tick();
    expect(dialog()?.querySelector('.starledger-month')?.textContent).toBe('mars 2026');
    document.head.innerHTML = '';
  });

  it('goes back across a year boundary keeping the day', async () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    open();
    await tick();
    dialog()?.querySelector<HTMLElement>('[data-nav="prev"]')?.click();
    await tick();
    expect(stats().at(-1)?.url).toContain('today=2025-12-15');
    expect(dialog()?.querySelector('.starledger-month')?.textContent).toBe('December 2025');
  });

  it('shows 29 bars for February of a leap year', async () => {
    vi.setSystemTime(new Date('2028-02-10T12:00:00Z'));
    gm.respondWith(() => ({
      status: 200,
      body: JSON.stringify({ ...statsOf(), days: days('2028-02', 29) }),
    }));
    open();
    await tick();
    expect(dialog()?.querySelectorAll('[data-day]')).toHaveLength(29);
  });

  it('empties the calendar when the request fails', async () => {
    open();
    await tick();
    expect(dialog()?.querySelectorAll('[data-day]')).toHaveLength(31);
    gm.respondWith(() => ({ status: 401, body: '' }));
    dialog()?.querySelector<HTMLElement>('[data-nav="prev"]')?.click();
    await tick();
    expect(dialog()?.querySelectorAll('[data-day]')).toHaveLength(0);
    expect(dialog()?.querySelector('.starledger-error')).not.toBeNull();
  });

  it('moves focus back to the selected day after a calendar click, not on first open', async () => {
    open();
    await tick();
    expect(dialog()?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.hasAttribute('data-day')).toBe(false);
    dialog()?.querySelector<HTMLElement>('[data-day="2026-03-10"]')?.click();
    await tick();
    const focused = document.activeElement as HTMLElement | null;
    expect(focused?.dataset.day).toBe('2026-03-10');
  });
});
