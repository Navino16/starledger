import type { ApiError, StatsResponse } from '@app/shared';
import { errorKey, type MessageKey, type T } from '../i18n';
import type { SyncState } from '../sync/queue';
import { configureBoxContent, el, mountBox } from './dom';
import { formatAmount, formatPartial, formatTime } from './format';

export type BoxModel = {
  state: SyncState;
  stats: StatsResponse | null;
  statsAt: number | null;
  stale: boolean;
  configured: boolean;
  consent: boolean;
  statsError?: ApiError | null;
};

export type BoxHandlers = { t: T; onConfigure: () => void; onOpenDetails: () => void };

const TILES = [
  ['metal', 'tileMetal'],
  ['crystal', 'tileCrystal'],
  ['deuterium', 'tileDeuterium'],
  ['darkMatter', 'tileDarkMatter'],
  ['artefacts', 'tileArtefacts'],
  ['msu', 'tileMsu'],
] as const satisfies readonly [keyof StatsResponse['summary']['tiles'], MessageKey][];

function tile(doc: Document, label: string, value: string): HTMLElement {
  return el(
    doc,
    'span',
    { className: 'starledger-tile' },
    el(doc, 'span', { className: 'starledger-label', textContent: label }),
    el(doc, 'span', { className: 'starledger-value', textContent: value }),
  );
}

function fuelValue(stats: StatsResponse | null): string {
  if (!stats) return '?';
  const { recorded, unknownCount } = stats.summary.fuel;
  return formatPartial(recorded, unknownCount);
}

function lithiumValue(stats: StatsResponse | null): string {
  const lithium = stats?.summary.anomalies?.lithium;
  return formatPartial(
    lithium?.net ?? null,
    (lithium?.spentUnknown ?? 0) + (lithium?.refundUnknown ?? 0),
  );
}

const DOT_CLASS = { up_to_date: 'is-ok', pending: 'is-pending', error: 'is-error' } as const;

function statusText(model: BoxModel, t: T): string {
  const { state } = model;
  if (state.status === 'error' && state.error) {
    return t('statusError', { error: t(errorKey(state.error)) });
  }
  if (state.status === 'pending') return t('statusPending', { n: String(state.pending) });
  return state.lastSyncAt === null
    ? t('statusUpToDateNever')
    : t('statusUpToDate', { time: formatTime(state.lastSyncAt) });
}

export function renderBox(container: HTMLElement, model: BoxModel, handlers: BoxHandlers): void {
  const doc = container.ownerDocument;
  const { t, onConfigure, onOpenDetails } = handlers;

  if (!model.consent || !model.configured) {
    container.replaceChildren(...configureBoxContent(doc, t, onConfigure).children);
    return;
  }

  const { stats } = model;
  const tiles = el(doc, 'button', {
    type: 'button',
    className: 'starledger-tiles',
    title: t('detailsHint'),
  });
  for (const [key, label] of TILES) {
    const node = tile(doc, t(label), formatAmount(stats ? stats.summary.tiles[key] : null));
    node.dataset.tile = key;
    tiles.append(node);
  }
  const fuel = tile(doc, t('tileFuel'), fuelValue(stats));
  fuel.dataset.tile = 'fuel';
  fuel.classList.add('starledger-fuel');
  tiles.append(fuel);
  const lithium = tile(doc, t('tileLithium'), lithiumValue(stats));
  lithium.dataset.tile = 'lithium';
  tiles.append(lithium);
  tiles.addEventListener('click', onOpenDetails);

  const { state } = model;
  const dot = el(doc, 'span', {
    className: `starledger-dot ${DOT_CLASS[state.status] ?? 'is-ok'}`,
  });
  if (state.status === 'error' && state.error) dot.title = t(errorKey(state.error));
  const header = el(
    doc,
    'div',
    { className: 'starledger-head' },
    el(doc, 'strong', { textContent: t('boxTitle') }),
    el(
      doc,
      'span',
      { className: 'starledger-state' },
      dot,
      el(doc, 'span', { className: 'starledger-status', textContent: statusText(model, t) }),
    ),
  );
  if (model.stale) {
    const text =
      model.statsAt === null ? t('stale') : t('staleAt', { time: formatTime(model.statsAt) });
    header.append(el(doc, 'em', { className: 'starledger-stale', textContent: text }));
  }

  const lines: HTMLElement[] = [];
  if (model.statsError && model.state.error !== model.statsError) {
    lines.push(
      el(doc, 'div', {
        className: 'starledger-status',
        textContent: t('statusError', { error: t(errorKey(model.statsError)) }),
      }),
    );
  }
  container.replaceChildren(header, tiles, ...lines);
}

export function mountStatsBox(doc: Document, model: BoxModel, handlers: BoxHandlers): void {
  const box = el(doc, 'div');
  renderBox(box, model, handlers);
  mountBox(doc, box);
}
