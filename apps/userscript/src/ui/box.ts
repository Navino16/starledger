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

const TILE_ORDER = ['metal', 'crystal', 'deuterium', 'darkMatter', 'artefacts', 'lithium', 'msu'];

function tile(doc: Document, label: string, value: string): HTMLElement {
  return el(
    doc,
    'span',
    { className: 'starledger-tile' },
    el(doc, 'span', { className: 'starledger-label', textContent: label }),
    el(doc, 'span', { className: 'starledger-value', textContent: value }),
  );
}

function lithiumValue(stats: StatsResponse | null): string {
  const lithium = stats?.summary.anomalies?.lithium;
  return formatPartial(
    lithium?.net ?? null,
    (lithium?.spentUnknown ?? 0) + (lithium?.refundUnknown ?? 0),
  );
}

const DOT_CLASS = { up_to_date: 'is-ok', pending: 'is-pending', error: 'is-error' } as const;

function statusText(model: BoxModel, t: T): { text: string; title?: string } {
  const { state } = model;
  if (state.status === 'error' && state.error) {
    return { text: t('statusError', { error: t(errorKey(state.error)) }) };
  }
  if (state.status === 'pending') return { text: t('statusPending', { n: String(state.pending) }) };
  if (state.lastSyncAt === null) return { text: t('statusUpToDateNever') };
  // The green dot says "up to date": the time alone keeps the header on one line in the 168px box
  const time = formatTime(state.lastSyncAt);
  return { text: time, title: t('statusUpToDate', { time }) };
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
  const nodes = new Map<string, HTMLElement>();
  for (const [key, label] of TILES) {
    const node = tile(doc, t(label), formatAmount(stats ? stats.summary.tiles[key] : null));
    node.dataset.tile = key;
    nodes.set(key, node);
  }
  const lithium = tile(doc, t('tileLithium'), lithiumValue(stats));
  lithium.dataset.tile = 'lithium';
  nodes.set('lithium', lithium);
  nodes.get('msu')?.classList.add('starledger-wide');
  // Fuel has no tile: it is already deducted from the deuterium tile and shown in the detail
  for (const key of TILE_ORDER) {
    const node = nodes.get(key);
    if (node) tiles.append(node);
  }
  tiles.addEventListener('click', onOpenDetails);

  const { state } = model;
  const dot = el(doc, 'span', {
    className: `starledger-dot ${DOT_CLASS[state.status] ?? 'is-ok'}`,
  });
  if (state.status === 'error' && state.error) dot.title = t(errorKey(state.error));
  const status = statusText(model, t);
  const stateNode = el(
    doc,
    'span',
    { className: 'starledger-state' },
    dot,
    el(doc, 'span', { className: 'starledger-status', textContent: status.text }),
  );
  if (status.title) stateNode.title = status.title;
  const header = el(
    doc,
    'div',
    { className: 'starledger-head' },
    el(doc, 'strong', { textContent: t('boxTitle') }),
    stateNode,
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
