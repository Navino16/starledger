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

function shipsTable(
  doc: Document,
  t: T,
  found: Record<string, number> | undefined,
  lost: Record<string, number> | undefined,
) {
  const ids = [...new Set([...Object.keys(found ?? {}), ...Object.keys(lost ?? {})])].sort(
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
        ...[id, num(found?.[id] ?? 0), num(lost?.[id] ?? 0)].map((c) =>
          el(doc, 'td', { textContent: c }),
        ),
      ),
    );
  }
  return table;
}

function balanceTable(doc: Document, t: T, stats: StatsResponse) {
  const { balance, fuel } = stats.summary;
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
  for (const [key, label] of CATEGORIES) {
    const isFuel = key === 'fuel';
    const cells = [
      t(label),
      isFuel ? '-' : resourcesText(t, balance?.[key]?.gains),
      isFuel ? '-' : resourcesText(t, balance?.[key]?.losses),
      isFuel ? (fuel?.unknownCount > 0 ? `? (${fuel.unknownCount})` : num(fuel?.recorded)) : '-',
    ];
    const row = el(doc, 'tr', {}, ...cells.map((c) => el(doc, 'td', { textContent: c })));
    row.dataset.category = key;
    table.append(row);
  }
  return table;
}

function renderContent(doc: Document, t: T, stats: StatsResponse): HTMLElement[] {
  const { summary } = stats;
  const nodes: HTMLElement[] = [
    el(doc, 'h4', { textContent: t('sectionOutcomes') }),
    outcomesList(doc, t, summary.expeditions?.outcomes),
    el(doc, 'h4', { textContent: t('sectionShips') }),
    shipsTable(doc, t, summary.expeditions?.shipsFound, summary.expeditions?.shipsLost),
    el(doc, 'h4', { textContent: t('sectionBalance') }),
    balanceTable(doc, t, stats),
    el(doc, 'p', { className: 'starledger-note', textContent: t('balanceScope') }),
  ];
  const unrecognized = stats.counts?.unrecognized ?? 0;
  if (unrecognized > 0) {
    nodes.push(
      el(doc, 'p', {
        className: 'starledger-unrecognized',
        textContent: t('unrecognized', { n: String(unrecognized) }),
      }),
    );
  }
  const conflicts = summary.conflictCount ?? 0;
  if (conflicts > 0) {
    nodes.push(
      el(doc, 'p', {
        className: 'starledger-conflicts',
        textContent: t('conflicts', { n: String(conflicts) }),
      }),
    );
  }
  return nodes;
}

export function openDetails(ctx: UiContext, env: DetailsEnv): void {
  const { doc, gm, t } = ctx;
  doc.getElementById(DETAILS_ID)?.remove();

  //! AGENTS.md §1.7: user-opened dialog, monetization elements untouched, fully removed on close
  const overlay = el(doc, 'div', { id: DETAILS_ID, className: 'starledger-overlay' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const panel = el(doc, 'div', { className: 'starledger-dialog' });
  const body = el(doc, 'div', { className: 'starledger-dialog-body' });
  const buttons = new Map<StatsPeriod, HTMLButtonElement>();
  const bar = el(doc, 'div', { className: 'starledger-periods' });
  const closeButton = el(doc, 'button', { type: 'button', textContent: t('close') });

  let seq = 0;
  let open = true;

  const close = () => {
    open = false;
    doc.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  const showError = (error: ApiError) => {
    body.replaceChildren(
      el(doc, 'p', {
        className: 'starledger-error',
        textContent: t('statusError', { error: t(errorKey(error)) }),
      }),
    );
  };

  async function load(period: StatsPeriod): Promise<void> {
    const mine = ++seq;
    for (const [p, b] of buttons) b.setAttribute('aria-pressed', String(p === period));
    body.replaceChildren(el(doc, 'p', { textContent: t('loading') }));
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
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  doc.addEventListener('keydown', onKey);

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
  overlay.append(panel);
  doc.body.append(overlay);
  void load('day');
}
