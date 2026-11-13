import type { DetailRow, DetailRowKey, StatsResponse } from '@app/shared';
import { describe, expect, it } from 'vitest';
import { createT } from '../src/i18n';
import { renderTable } from '../src/ui/details/table';

const t = createT('en');
const none: DetailRow = {
  count: null,
  resources: null,
  msu: null,
  darkMatter: null,
  artefacts: null,
  lithium: null,
  unknown: 0,
};
const row = (patch: Partial<DetailRow>): DetailRow => ({ ...none, ...patch });
const res = (metal: number, crystal: number, deuterium: number) => ({ metal, crystal, deuterium });

const KEYS: DetailRowKey[] = [
  'expeditions',
  'combats',
  'recycling',
  'wreckfields',
  'anomalies',
  'discoveries',
  'fuel',
  'trades',
  'total',
];

function statsOf(
  rows: Partial<Record<DetailRowKey, DetailRow>> | undefined,
  extra: Record<string, unknown> = {},
  settings: Record<string, unknown> = {},
): StatsResponse {
  const full = rows && Object.fromEntries(KEYS.map((k) => [k, rows[k] ?? none]));
  return {
    period: 'day',
    range: null,
    generatedAt: 1,
    counts: {},
    settings,
    summary: {
      tiles: { metal: 1, crystal: 2, deuterium: 3, darkMatter: 0, artefacts: 0, msu: 4242 },
      ...(full ? { rows: full } : {}),
      ...extra,
    },
  } as unknown as StatsResponse;
}

const typical = () =>
  statsOf({
    expeditions: row({ count: 5, resources: res(1000, 2000, 3000), msu: 5000, artefacts: 1 }),
    combats: row({ count: 2, resources: res(-500, 10, 0), msu: -400 }),
    discoveries: row({ count: 4, artefacts: 2 }),
    fuel: row({ count: 3, resources: res(0, 0, -777), msu: -777 }),
    trades: row({ count: 4, resources: res(300, -100, 0), msu: 200 }),
    total: row({ count: 14, resources: res(1, 2, 3), msu: 4242, darkMatter: 0, artefacts: 3 }),
  });

const rowEl = (root: HTMLElement, key: string) =>
  root.querySelector<HTMLElement>(`[data-category="${key}"]`);
const cell = (root: HTMLElement, key: string, col: string) =>
  rowEl(root, key)?.querySelector<HTMLElement>(`[data-col="${col}"]`);

describe('renderTable', () => {
  it('renders 9 rows with trades and 8 without', () => {
    const withTrades = renderTable(document, t, typical());
    expect(withTrades.querySelectorAll('tr[data-category]')).toHaveLength(9);
    const body = statsOf({ total: row({ count: 0, msu: 0 }) });
    expect(renderTable(document, t, body).querySelectorAll('tr[data-category]')).toHaveLength(8);
  });

  it('orders the rows and puts the total last', () => {
    const keys = [
      ...renderTable(document, t, typical()).querySelectorAll<HTMLElement>('tr[data-category]'),
    ].map((r) => r.dataset.category);
    expect(keys).toEqual(KEYS);
  });

  it('has an icon or label header per column with the label as title', () => {
    const table = renderTable(document, t, typical());
    const ths = [...table.querySelectorAll<HTMLElement>('th[data-col]')];
    expect(ths.map((h) => h.dataset.col)).toEqual([
      'count',
      'metal',
      'crystal',
      'deuterium',
      'msu',
      'darkMatter',
      'artefacts',
      'lithium',
    ]);
    expect(ths[1]?.title).toBe('Metal');
    expect(ths[1]?.querySelector('[title="Metal"]')).not.toBeNull();
    expect(ths[4]?.textContent).toBe('MSU');
  });

  it('shows a dash for not applicable cells', () => {
    const root = renderTable(document, t, typical());
    for (const col of ['metal', 'crystal', 'deuterium', 'msu']) {
      expect(cell(root, 'discoveries', col)?.textContent).toBe('-');
    }
    expect(cell(root, 'discoveries', 'artefacts')?.textContent).toBe('2');
    expect(cell(root, 'expeditions', 'lithium')?.textContent).toBe('-');
  });

  it('gives negative values the loss class and never prints -0', () => {
    const body = statsOf({
      combats: row({ count: 1, resources: res(-500, 10, -0.2), msu: -400 }),
      total: row({ count: 1, resources: res(0, 0, 0), msu: 0 }),
    });
    const root = renderTable(document, t, body);
    expect(cell(root, 'combats', 'metal')?.classList.contains('is-negative')).toBe(true);
    expect(cell(root, 'combats', 'metal')?.textContent).toBe('-500');
    expect(cell(root, 'combats', 'crystal')?.classList.contains('is-negative')).toBe(false);
    expect(cell(root, 'combats', 'deuterium')?.classList.contains('is-negative')).toBe(false);
    expect(root.textContent).not.toContain('-0');
  });

  it('keeps the unknown marker on the concerned columns', () => {
    const body = statsOf({
      fuel: row({ count: 3, resources: res(0, 0, -777), msu: -777, unknown: 2 }),
      anomalies: row({ count: 1, resources: res(1, 1, 1), msu: 3, lithium: -1000, unknown: 1 }),
      total: row({ count: 4, resources: res(1, 2, 3), msu: 4242, lithium: -1000, unknown: 3 }),
    });
    const root = renderTable(document, t, body);
    expect(cell(root, 'fuel', 'deuterium')?.textContent).toBe('-777 + ? (2)');
    expect(cell(root, 'fuel', 'msu')?.textContent).toBe('-777 + ? (2)');
    expect(cell(root, 'fuel', 'metal')?.textContent).toBe('0');
    expect(cell(root, 'anomalies', 'lithium')?.textContent).toBe('-1.0k + ? (1)');
    expect(cell(root, 'anomalies', 'msu')?.textContent).toBe('3');
  });

  it('marks Total deuterium and MSU for fuel unknowns only', () => {
    const body = statsOf({
      fuel: row({ count: 3, resources: res(0, 0, -777), msu: -777, unknown: 2 }),
      total: row({ count: 4, resources: res(1, 2, 3), msu: 4242, lithium: -1000, unknown: 2 }),
    });
    const root = renderTable(document, t, body);
    expect(cell(root, 'total', 'msu')?.textContent).toBe('4.2k + ? (2)');
    expect(cell(root, 'total', 'deuterium')?.textContent).toBe('3 + ? (2)');
    expect(cell(root, 'total', 'lithium')?.textContent).toBe('-1.0k');
  });

  it('marks Total lithium for anomaly unknowns only', () => {
    const body = statsOf({
      anomalies: row({ count: 1, resources: res(1, 1, 1), msu: 3, lithium: -1000, unknown: 1 }),
      total: row({ count: 4, resources: res(1, 2, 3), msu: 4242, lithium: -1000, unknown: 1 }),
    });
    const root = renderTable(document, t, body);
    expect(cell(root, 'total', 'lithium')?.textContent).toBe('-1.0k + ? (1)');
    expect(cell(root, 'total', 'msu')?.textContent).toBe('4.2k');
    expect(cell(root, 'total', 'deuterium')?.textContent).toBe('3');
  });

  it('shows no fuel marker anywhere when fuel is ignored', () => {
    const body = statsOf({
      fuel: row({ count: 3, resources: null, msu: 0, unknown: 2 }),
      total: row({ count: 4, resources: res(1, 2, 3), msu: 4242, unknown: 2 }),
    });
    const root = renderTable(document, t, body);
    expect(cell(root, 'fuel', 'deuterium')?.textContent).toBe('-');
    expect(cell(root, 'fuel', 'msu')?.textContent).toBe('-');
    expect(cell(root, 'total', 'msu')?.textContent).toBe('4.2k');
    expect(cell(root, 'total', 'deuterium')?.textContent).toBe('3');
    expect(root.textContent).not.toContain('?');
  });

  it('lists the anomaly action counts in the row tooltip', () => {
    const body = statsOf(
      { anomalies: row({ count: 1, resources: res(0, 0, 0), msu: 0 }) },
      {
        anomalies: {
          lithium: { scans: 4, collects: 3, darkMatterSpent: 0, darkMatterUnknown: 0 },
          rewards: { count: 2 },
          combats: { count: 1 },
        },
      },
    );
    expect(rowEl(renderTable(document, t, body), 'anomalies')?.title).toContain(
      'scans: 4 · collects: 3 · rewards: 2 · combats: 1',
    );
  });

  it('adds the reward experience to the anomalies tooltip, unknown ones marked', () => {
    const hint = (rewards: Record<string, unknown>) =>
      rowEl(renderTable(document, t, statsOf(undefined, { anomalies: { rewards } })), 'anomalies')
        ?.title ?? '';
    expect(hint({ count: 1, xpByLifeform: { '1': 8888, '2': 8888 }, xpUnknown: 0 })).toContain(
      'Rewards: XP 17.8k',
    );
    expect(hint({ count: 2, xpByLifeform: { '1': 4444 }, xpUnknown: 1 })).toContain(
      'Rewards: XP 4.4k + ? (1)',
    );
    expect(hint({ count: 1, xpByLifeform: {}, xpUnknown: 0 })).not.toContain('XP');
    expect(hint({ count: 1 })).not.toContain('XP');
  });

  it('shows the anomaly counts hint when rewards or combats exist without lithium', () => {
    const body = statsOf(undefined, {
      anomalies: { rewards: { count: 2 }, combats: { count: 1 } },
    });
    expect(rowEl(renderTable(document, t, body), 'anomalies')?.title).toContain(
      'scans: 0 · collects: 0 · rewards: 2 · combats: 1',
    );
  });

  it('adds the ships tooltip and the paid Dark Matter on anomalies', () => {
    const body = statsOf(
      { anomalies: row({ count: 1, resources: res(0, 0, 0), msu: 0 }) },
      {
        anomalies: {
          lithium: { darkMatterSpent: 50, darkMatterUnknown: 0 },
        },
      },
    );
    const root = renderTable(document, t, body);
    expect(rowEl(root, 'anomalies')?.title).toContain(t('shipsValueIncluded'));
    expect(rowEl(root, 'anomalies')?.title).toContain('Dark Matter paid: 50');
    expect(rowEl(root, 'expeditions')?.title).toBe(t('shipsValueIncluded'));
    expect(rowEl(root, 'combats')?.title).toBe(t('shipsValueIncluded'));
    expect(rowEl(root, 'wreckfields')?.title).toBe(t('shipsValueIncluded'));
    expect(rowEl(root, 'recycling')?.title).toBe('');
  });

  it('shows ? cells without throwing when the server sent no rows', () => {
    const root = renderTable(document, t, statsOf(undefined));
    expect(root.querySelectorAll('tr[data-category]')).toHaveLength(8);
    expect(cell(root, 'expeditions', 'metal')?.textContent).toBe('?');
    expect(cell(root, 'total', 'count')?.textContent).toBe('?');
  });

  it('mutes zero cells but not unknown or non-zero ones', () => {
    const root = renderTable(document, t, typical());
    expect(cell(root, 'combats', 'deuterium')?.classList.contains('is-zero')).toBe(true);
    expect(cell(root, 'combats', 'crystal')?.classList.contains('is-zero')).toBe(false);
    expect(cell(root, 'total', 'darkMatter')?.classList.contains('is-zero')).toBe(true);
  });

  it('sits in a horizontal scroll container', () => {
    const root = renderTable(document, t, typical());
    expect(root.className).toBe('starledger-tablewrap');
    expect(root.querySelector('table')).not.toBeNull();
  });
});

describe('row hints', () => {
  const titles = (body: StatsResponse) => {
    const root = renderTable(document, t, body);
    return (key: string) => rowEl(root, key)?.title ?? '';
  };

  it('adds no hint beyond the ships value for an empty response', () => {
    const title = titles(typical());
    expect(title('combats')).toBe(t('shipsValueIncluded'));
    expect(title('fuel')).toBe('');
    expect(title('total')).toBe('');
  });

  it('puts each detail on its own row', () => {
    const body = statsOf(
      { total: row({ count: 0 }) },
      {
        fuel: { recorded: 0, departures: 3, unknownCount: 2 },
        combats: { won: 3, lost: 1, draw: 2 },
        discoveries: { count: 1, xpByLifeform: { '1': 100, '2': 50 }, artefacts: 0 },
        anomalies: {
          lithium: {
            spent: 1200,
            refunded: 200,
            net: -1000,
            spentUnknown: 1,
            refundUnknown: 0,
            darkMatterSpent: 50,
            darkMatterUnknown: 0,
            scans: 4,
            collects: 3,
          },
          rewards: { count: 2 },
          combats: { count: 1 },
        },
        conflictCount: 2,
      },
      { ignoreConsumption: true },
    );
    body.counts = { unrecognized: 1 } as never;
    const title = titles(body);
    expect(title('fuel')).toContain('2 departures with unknown fuel');
    expect(title('fuel')).toContain('Fuel is ignored');
    expect(title('anomalies')).toContain('spent 1.2k + ? (1), refunded 200, net -1k + ? (1)');
    expect(title('anomalies')).toContain('Dark Matter paid: 50');
    expect(title('anomalies')).toContain('scans: 4 · collects: 3 · rewards: 2 · combats: 1');
    expect(title('combats')).toContain('won 3, lost 1, draw 2');
    expect(title('discoveries')).toContain('XP 150');
    expect(title('total')).toContain('1 unrecognized report');
    expect(title('total')).toContain('2 conflicts');
  });
});
