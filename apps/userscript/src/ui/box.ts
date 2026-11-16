import type { ApiError, StatsResponse } from '@app/shared';
import { errorKey, type MessageKey, type T } from '../i18n';
import type { SyncState } from '../sync/queue';
import { configureBoxContent, el, mountBox } from './dom';
import { amountParts, formatPartial, formatTime } from './format';
import { type IconKind, resourceIcon } from './icons';

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

// Same figures, format and colours as the detail table, so the box and the detail read alike
function value(doc: Document, n: number | null, unknown = 0): HTMLElement {
  const { value: num, unit } = amountParts(n);
  const node = el(doc, 'span', { className: 'starledger-value', textContent: num });
  if (unit) node.append(el(doc, 'span', { className: 'starledger-unit', textContent: unit }));
  if (unknown > 0)
    node.append(el(doc, 'span', { className: 'starledger-partial', textContent: '+?' }));
  if (n === null || num === '0') node.classList.add('is-zero');
  else if (n < 0) node.classList.add('is-negative');
  return node;
}

function tile(doc: Document, key: string, label: string, figure: HTMLElement): HTMLElement {
  const name = el(doc, 'span', { className: 'starledger-label', textContent: label });
  const node = el(doc, 'span', { className: 'starledger-tile' });
  node.dataset.tile = key;
  if (key === 'msu') {
    node.append(name, figure);
    return node;
  }
  name.classList.add('starledger-sr');
  node.append(resourceIcon(doc, key as IconKind, label), name, figure);
  return node;
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
    nodes.set(key, tile(doc, key, t(label), value(doc, stats ? stats.summary.tiles[key] : null)));
  }
  const lithium = stats?.summary.anomalies?.lithium;
  const lithiumUnknown = (lithium?.spentUnknown ?? 0) + (lithium?.refundUnknown ?? 0);
  const lithiumTile = tile(
    doc,
    'lithium',
    t('tileLithium'),
    value(doc, lithium?.net ?? null, lithiumUnknown),
  );
  if (lithiumUnknown > 0) lithiumTile.title = formatPartial(lithium?.net ?? null, lithiumUnknown);
  nodes.set('lithium', lithiumTile);
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
