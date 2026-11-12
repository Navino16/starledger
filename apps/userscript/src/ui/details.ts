import type {
  AccountRef,
  ApiError,
  BalanceCategory,
  StatsPeriod,
  StatsResponse,
} from '@app/shared';
import { todayKey } from '../env/page';
import { errorKey, type MessageKey, type T } from '../i18n';
import { loadSettings } from '../storage';
import { createApi } from '../sync/api';
import { CLIENT_VERSION } from '../version';
import { el, type UiContext } from './dom';
import { formatAmount } from './format';
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

function balanceTable(doc: Document, t: T, stats: StatsResponse) {
  const { balance, fuel, tiles } = stats.summary;
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
  const fuelCell = fuel?.unknownCount > 0 ? `? (${fuel.unknownCount})` : num(fuel?.recorded);
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
  const handle = openPanel(
    doc,
    { id: DETAILS_ID, title: t('detailsTitle'), closeLabel: t('close'), closeOnOutside: true },
    [bar, body],
  );
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

  async function load(period: StatsPeriod, before?: Promise<unknown>): Promise<void> {
    const mine = ++seq;
    for (const [p, b] of buttons) b.setAttribute('aria-pressed', String(p === period));
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
      today: todayKey(env.serverUtcOffsetMinutes),
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
      body.replaceChildren(...renderContent(doc, t, result.data));
    } catch {
      showError('server_error');
    }
  }

  for (const [period, key] of PERIODS) {
    const b = el(doc, 'button', { type: 'button', textContent: t(key) });
    b.dataset.period = period;
    b.addEventListener('click', () => void load(period));
    buttons.set(period, b);
    bar.append(b);
  }

  void load('day', ready());
}
