import type {
  AccountRef,
  ApiError,
  BalanceCategory,
  StatsPeriod,
  StatsResponse,
} from '@app/shared';
import { todayKey } from '../env/page';
import { detectLang, errorKey, type MessageKey, type T } from '../i18n';
import { loadSettings } from '../storage';
import { createApi } from '../sync/api';
import { CLIENT_VERSION } from '../version';
import { renderCalendar, shiftMonth } from './details/calendar';
import { el, type UiContext } from './dom';
import { formatAmount, formatPartial } from './format';
import { openPanel } from './panel';

export const DETAILS_ID = 'starledger-details';

export type DetailsEnv = { account: AccountRef; serverUtcOffsetMinutes: number };

const PERIODS: [StatsPeriod, MessageKey][] = [
  ['day', 'periodDay'],
  ['week', 'periodWeek'],
  ['month', 'periodMonth'],
  ['all', 'periodAll'],
];

const CATEGORIES: [BalanceCategory, MessageKey][] = [
  ['expeditions', 'catExpeditions'],
  ['combats', 'catCombats'],
  ['recycling', 'catRecycling'],
  ['wreckfields', 'catWreckfields'],
  ['anomalies', 'catAnomalies'],
  ['fuel', 'catFuel'],
];

const OUTCOME_KEYS: Record<string, MessageKey> = {
  resources: 'outResources',
  darkmatter: 'outDarkmatter',
  nothing: 'outNothing',
  ships: 'outShips',
  trader: 'outTrader',
  item: 'outItem',
  blackhole: 'outBlackhole',
  early: 'outEarly',
  late: 'outLate',
  pirates: 'outPirates',
  aliens: 'outAliens',
};

const num = (v: unknown): string => formatAmount(typeof v === 'number' ? v : null);

type Cell = (string | Node)[];

function amount(doc: Document, res: string, value: unknown): HTMLElement {
  const node = el(doc, 'span', { className: 'starledger-amount', textContent: num(value) });
  node.dataset.res = res;
  return node;
}

function resourcesCell(
  doc: Document,
  t: T,
  r: { metal?: number; crystal?: number; deuterium?: number } | undefined,
): Cell {
  return [
    `${t('resMetal')} `,
    amount(doc, 'metal', r?.metal),
    ` · ${t('resCrystal')} `,
    amount(doc, 'crystal', r?.crystal),
    ` · ${t('resDeuterium')} `,
    amount(doc, 'deuterium', r?.deuterium),
  ];
}

function outcomesList(doc: Document, t: T, outcomes: Record<string, number> | undefined) {
  const entries = Object.entries(outcomes ?? {}).filter(([, n]) => n > 0);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const list = el(doc, 'ul', { className: 'starledger-outcomes' });
  if (total === 0) {
    list.append(el(doc, 'li', { textContent: t('noData') }));
    return list;
  }
  for (const [key, n] of entries) {
    const label = OUTCOME_KEYS[key] ? t(OUTCOME_KEYS[key]) : key;
    list.append(
      el(doc, 'li', { textContent: `${label}: ${n} (${Math.round((n / total) * 100)}%)` }),
    );
  }
  return list;
}

function sumShips(...maps: (Record<string, number> | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) for (const [id, n] of Object.entries(m ?? {})) out[id] = (out[id] ?? 0) + n;
  return out;
}

function shipsTable(
  doc: Document,
  t: T,
  found: Record<string, number>,
  lost: Record<string, number>,
) {
  const ids = [...new Set([...Object.keys(found), ...Object.keys(lost)])].sort(
    (a, b) => Number(a) - Number(b),
  );
  const table = el(doc, 'table', { className: 'starledger-ships' });
  table.append(
    el(
      doc,
      'tr',
      {},
      ...[t('shipId'), t('shipsFound'), t('shipsLost')].map((h) =>
        el(doc, 'th', { textContent: h }),
      ),
    ),
  );
  if (ids.length === 0) {
    table.append(el(doc, 'tr', {}, el(doc, 'td', { colSpan: 3, textContent: t('noData') })));
  }
  for (const id of ids) {
    table.append(
      el(
        doc,
        'tr',
        {},
        ...[id, num(found[id] ?? 0), num(lost[id] ?? 0)].map((c) =>
          el(doc, 'td', { textContent: c }),
        ),
      ),
    );
  }
  return table;
}

function discoveriesText(t: T, stats: StatsResponse): string {
  const d = stats.summary.discoveries;
  const xp = d?.xpByLifeform
    ? Object.values(d.xpByLifeform).reduce((sum, v) => sum + v, 0)
    : undefined;
  return `${t('discoveriesCount', { n: num(d?.count) })} · ${t('xp')} ${num(xp)} · ${t('tileArtefacts')} ${num(d?.artefacts)}`;
}

function lithiumText(t: T, stats: StatsResponse): string {
  const a = stats.summary.anomalies;
  const l = a?.lithium;
  const known = (v: unknown) => (typeof v === 'number' ? v : null);
  const spent = formatPartial(known(l?.spent), l?.spentUnknown);
  const refunded = formatPartial(known(l?.refunded), l?.refundUnknown);
  const net = formatPartial(known(l?.net), (l?.spentUnknown ?? 0) + (l?.refundUnknown ?? 0));
  let text = t('lithiumSummary', { spent, refunded, net });
  if (l && (l.darkMatterSpent > 0 || l.darkMatterUnknown > 0)) {
    const paid = formatPartial(l.darkMatterSpent, l.darkMatterUnknown);
    text += ` · ${t('anomalyDarkMatter', { n: paid })}`;
  }
  return `${text} ${t('anomalyCounts', {
    scans: num(l?.scans),
    collects: num(l?.collects),
    rewards: num(a?.rewards?.count),
    combats: num(a?.combats?.count),
  })}`;
}

function balanceTable(doc: Document, t: T, stats: StatsResponse) {
  const { balance, fuel, tiles, trades } = stats.summary;
  const ignoreFuel = stats.settings?.ignoreConsumption === true;
  const table = el(doc, 'table', { className: 'starledger-balance' });
  table.append(
    el(
      doc,
      'tr',
      {},
      ...[t('colCategory'), t('colGains'), t('colLosses'), t('colFuel')].map((h) =>
        el(doc, 'th', { textContent: h }),
      ),
    ),
  );
  const fuelCell = formatPartial(
    typeof fuel?.recorded === 'number' ? fuel.recorded : null,
    fuel?.unknownCount,
  );
  const toCell = (c: Cell) => el(doc, 'td', {}, ...c);
  for (const [key, label] of CATEGORIES) {
    const cells: Cell[] =
      key === 'fuel'
        ? [[t(label)], ['-'], ['-'], [ignoreFuel ? `${fuelCell} (${t('fuelIgnored')})` : fuelCell]]
        : [
            [t(label)],
            resourcesCell(doc, t, balance?.[key]?.gains),
            resourcesCell(doc, t, balance?.[key]?.losses),
            ['-'],
          ];
    const row = el(doc, 'tr', {}, ...cells.map(toCell));
    row.dataset.category = key;
    table.append(row);
    if (key === 'anomalies') {
      // Lithium and Dark Matter keep their own units, never summed with resources
      const lithium = el(
        doc,
        'tr',
        {},
        ...([[t('catAnomalyLithium')], [lithiumText(t, stats)], ['-'], ['-']] as Cell[]).map(
          toCell,
        ),
      );
      lithium.dataset.category = 'anomalies-lithium';
      table.append(lithium);
    }
    if (key === 'wreckfields') {
      // Lifeform discoveries: own units (XP, artefacts), never summed with resources
      const disc = el(
        doc,
        'tr',
        {},
        ...([[t('catDiscoveries')], [discoveriesText(t, stats)], ['-'], ['-']] as Cell[]).map(
          toCell,
        ),
      );
      disc.dataset.category = 'discoveries';
      table.append(disc);
    }
  }
  const tradesRow = el(
    doc,
    'tr',
    {},
    ...(
      [
        [
          `${t('catTrades')} ${t('tradesCounts', {
            received: num(trades?.receivedCount),
            delivered: num(trades?.deliveredCount),
          })}`,
        ],
        resourcesCell(doc, t, trades?.received),
        resourcesCell(doc, t, trades?.delivered),
        ['-'],
      ] as Cell[]
    ).map(toCell),
  );
  tradesRow.dataset.category = 'trades';
  table.append(tradesRow);
  const net = el(
    doc,
    'tr',
    {},
    el(doc, 'td', { textContent: t('catNet') }),
    el(
      doc,
      'td',
      { colSpan: 3 },
      ...resourcesCell(doc, t, tiles),
      ` · ${t('tileMsu')} `,
      amount(doc, 'msu', tiles?.msu),
    ),
  );
  net.dataset.category = 'net';
  table.append(net);
  return table;
}

function tradesNetNote(doc: Document, t: T, stats: StatsResponse): HTMLElement | null {
  const trades = stats.summary.trades;
  if (!trades?.received || !trades.delivered) return null;
  const { received: r, delivered: d } = trades;
  const note = el(
    doc,
    'p',
    { className: 'starledger-note' },
    `${t('tradesNet')} `,
    ...resourcesCell(doc, t, {
      metal: r.metal - d.metal,
      crystal: r.crystal - d.crystal,
      deuterium: r.deuterium - d.deuterium,
    }),
    ` — ${t(stats.settings?.includeTradesInBalance ? 'tradesIncluded' : 'tradesExcluded')}`,
  );
  note.dataset.tradesNet = '';
  return note;
}

function renderContent(doc: Document, t: T, stats: StatsResponse): HTMLElement[] {
  const { summary } = stats;
  const nodes: HTMLElement[] = [
    el(doc, 'h4', { textContent: t('sectionOutcomes') }),
    outcomesList(doc, t, summary.expeditions?.outcomes),
    el(doc, 'h4', { textContent: t('sectionShips') }),
    shipsTable(
      doc,
      t,
      sumShips(summary.expeditions?.shipsFound),
      sumShips(summary.expeditions?.shipsLost, summary.combats?.shipsLost),
    ),
    el(doc, 'h4', { textContent: t('sectionBalance') }),
    balanceTable(doc, t, stats),
    el(doc, 'p', {
      className: 'starledger-note',
      textContent: t(stats.settings?.ignoreConsumption ? 'balanceScopeNoFuel' : 'balanceScope'),
    }),
  ];
  const tradesNet = tradesNetNote(doc, t, stats);
  if (tradesNet) nodes.push(tradesNet);
  const unrecognized = stats.counts?.unrecognized ?? 0;
  if (unrecognized > 0) {
    nodes.push(
      el(doc, 'p', {
        className: 'starledger-unrecognized',
        textContent: t(unrecognized === 1 ? 'unrecognizedOne' : 'unrecognized', {
          n: String(unrecognized),
        }),
      }),
    );
  }
  const conflicts = summary.conflictCount ?? 0;
  if (conflicts > 0) {
    nodes.push(
      el(doc, 'p', {
        className: 'starledger-conflicts',
        textContent: t(conflicts === 1 ? 'conflictsOne' : 'conflicts', { n: String(conflicts) }),
      }),
    );
  }
  return nodes;
}

export function openDetails(ctx: UiContext, env: DetailsEnv): void {
  const { doc, gm, t } = ctx;
  const body = el(doc, 'div', { className: 'starledger-dialog-body' });
  const buttons = new Map<StatsPeriod, HTMLButtonElement>();
  const bar = el(doc, 'div', { className: 'starledger-periods' });
  const nav = el(doc, 'div', { className: 'starledger-monthnav' });
  const calendarBox = el(doc, 'div', {});
  const handle = openPanel(
    doc,
    { id: DETAILS_ID, title: t('detailsTitle'), closeLabel: t('close'), closeOnOutside: true },
    [bar, nav, calendarBox, body],
  );
  const monthFormat = new Intl.DateTimeFormat(detectLang(doc), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const state: { period: StatsPeriod; refDay: string } = {
    period: 'day',
    refDay: todayKey(env.serverUtcOffsetMinutes),
  };
  const monthLabel = el(doc, 'span', { className: 'starledger-month' });
  const isOpen = handle.isOpen;
  let seq = 0;

  const showError = (error: ApiError) => {
    body.replaceChildren(
      el(doc, 'p', {
        className: 'starledger-error',
        textContent: t('statusError', { error: t(errorKey(error)) }),
      }),
    );
  };

  const ready = (): Promise<unknown> => {
    const settings = loadSettings(gm);
    if (!settings.consent || !settings.serverUrl || !settings.apiKey) return Promise.resolve();
    //! AGENTS.md §4: flush on detail open (spec §4.1), our server only, no game request
    return ctx.queue
      .flush(
        createApi(gm, settings, CLIENT_VERSION),
        settings.deviceId,
        () => loadSettings(gm).consent,
      )
      .then(() => {
        if (isOpen()) ctx.refreshBox?.();
      })
      .catch(() => {});
  };

  const renderMonthLabel = () => {
    monthLabel.textContent = monthFormat.format(
      new Date(`${state.refDay.slice(0, 7)}-01T00:00:00Z`),
    );
  };

  async function load(before?: Promise<unknown>): Promise<void> {
    const mine = ++seq;
    const { period, refDay } = state;
    for (const [p, b] of buttons) b.setAttribute('aria-pressed', String(p === period));
    renderMonthLabel();
    body.replaceChildren(el(doc, 'p', { textContent: t('loading') }));
    await before;
    if (!isOpen() || mine !== seq) return;
    const settings = loadSettings(gm);
    //! AGENTS.md §1.9: consent and configuration re-checked before every request
    if (!settings.consent || !settings.serverUrl || !settings.apiKey) {
      showError('not_configured');
      return;
    }
    //! AGENTS.md §4: user-triggered, our server only, no game request, no timer
    const result = await createApi(gm, settings, CLIENT_VERSION).getStats({
      serverId: env.account.serverId,
      lang: env.account.lang,
      playerId: env.account.playerId,
      period,
      today: refDay,
    });
    if (!isOpen() || mine !== seq) return;
    if (!loadSettings(gm).consent) {
      showError('not_configured');
      return;
    }
    if (!result.ok) {
      showError(result.error);
      return;
    }
    try {
      calendarBox.replaceChildren(
        renderCalendar(doc, result.data.days, refDay, (day) =>
          change({ period: 'day', refDay: day }),
        ),
      );
      body.replaceChildren(...renderContent(doc, t, result.data));
    } catch {
      showError('server_error');
    }
  }

  function change(next: Partial<typeof state>): void {
    const merged = { ...state, ...next };
    if (merged.period === state.period && merged.refDay === state.refDay) return;
    Object.assign(state, merged);
    void load();
  }

  const navButton = (dir: 'prev' | 'next', key: MessageKey, delta: number) => {
    const b = el(doc, 'button', { type: 'button', textContent: dir === 'prev' ? '‹' : '›' });
    b.title = t(key);
    b.setAttribute('aria-label', t(key));
    b.dataset.nav = dir;
    b.addEventListener('click', () => change({ refDay: shiftMonth(state.refDay, delta) }));
    return b;
  };
  nav.append(navButton('prev', 'prevMonth', -1), monthLabel, navButton('next', 'nextMonth', 1));

  for (const [period, key] of PERIODS) {
    const b = el(doc, 'button', { type: 'button', textContent: t(key) });
    b.dataset.period = period;
    b.addEventListener('click', () => change({ period }));
    buttons.set(period, b);
    bar.append(b);
  }

  void load(ready());
}
