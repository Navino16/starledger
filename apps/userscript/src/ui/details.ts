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

export const DETAILS_ID = 'starledger-details';
const BOX_ID = 'starledger-box';

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

function resourcesText(
  t: T,
  r: { metal?: number; crystal?: number; deuterium?: number } | undefined,
) {
  return `${t('resMetal')} ${num(r?.metal)} · ${t('resCrystal')} ${num(r?.crystal)} · ${t('resDeuterium')} ${num(r?.deuterium)}`;
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
  for (const [key, label] of CATEGORIES) {
    const cells =
      key === 'fuel'
        ? [t(label), '-', '-', ignoreFuel ? `${fuelCell} (${t('fuelIgnored')})` : fuelCell]
        : [
            t(label),
            resourcesText(t, balance?.[key]?.gains),
            resourcesText(t, balance?.[key]?.losses),
            '-',
          ];
    const row = el(doc, 'tr', {}, ...cells.map((c) => el(doc, 'td', { textContent: c })));
    row.dataset.category = key;
    table.append(row);
    if (key === 'wreckfields') {
      // Lifeform discoveries: own units (XP, artefacts), never summed with resources
      const disc = el(
        doc,
        'tr',
        {},
        ...[t('catDiscoveries'), discoveriesText(t, stats), '-', '-'].map((c) =>
          el(doc, 'td', { textContent: c }),
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
    el(doc, 'td', {
      colSpan: 3,
      textContent: `${resourcesText(t, tiles)} · ${t('tileMsu')} ${num(tiles?.msu)}`,
    }),
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

function mountPanel(doc: Document, panel: HTMLElement): void {
  const parent = doc.getElementById('contentWrapper') ?? doc.getElementById('middle');
  if (parent) parent.prepend(panel);
  else if (doc.getElementById(BOX_ID)) doc.getElementById(BOX_ID)?.after(panel);
  else doc.body.prepend(panel);
}

let closeCurrent: (() => void) | null = null;

export function openDetails(ctx: UiContext, env: DetailsEnv): void {
  const { doc, gm, t } = ctx;
  closeCurrent?.();

  //! AGENTS.md §1.7: in-flow panel, no overlay, monetization elements untouched, fully removed on close
  const panel = el(doc, 'div', { id: DETAILS_ID, className: 'starledger-dialog' });
  panel.setAttribute('role', 'dialog');
  const body = el(doc, 'div', { className: 'starledger-dialog-body' });
  const buttons = new Map<StatsPeriod, HTMLButtonElement>();
  const bar = el(doc, 'div', { className: 'starledger-periods' });
  const closeButton = el(doc, 'button', { type: 'button', textContent: t('close') });
  const previousFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;

  let seq = 0;
  let open = true;

  function close() {
    if (!open) return;
    open = false;
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('click', onOutside);
    panel.remove();
    if (closeCurrent === close) closeCurrent = null;
    previousFocus?.focus();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
  function onOutside(e: MouseEvent) {
    const target = e.target;
    if (!(target instanceof Node) || panel.contains(target)) return;
    // The click that opened the panel comes from the box and must not close it
    if (target instanceof Element && target.closest(`#${BOX_ID}`)) return;
    close();
  }
  closeCurrent = close;

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
        if (open) ctx.refreshBox?.();
      })
      .catch(() => {});
  };

  async function load(period: StatsPeriod, before?: Promise<unknown>): Promise<void> {
    const mine = ++seq;
    for (const [p, b] of buttons) b.setAttribute('aria-pressed', String(p === period));
    body.replaceChildren(el(doc, 'p', { textContent: t('loading') }));
    await before;
    if (!open || mine !== seq) return;
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
    if (!open || mine !== seq) return;
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

  closeButton.addEventListener('click', close);
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('click', onOutside);

  panel.append(
    el(
      doc,
      'div',
      { className: 'starledger-dialog-head' },
      el(doc, 'strong', { textContent: t('detailsTitle') }),
      closeButton,
    ),
    bar,
    body,
  );
  mountPanel(doc, panel);
  closeButton.focus();
  void load('day', ready());
}
