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

const SVG_NS = 'http://www.w3.org/2000/svg';
// Filled polygon with an evenodd hole: no stroke dashes, which some renderers drop (see details/donut.ts)
const GEAR_PATH =
  'M13.35 6.35 L15.49 6.71 L15.49 9.29 L13.35 9.65 L12.95 10.61 L14.21 12.39 L12.39 14.21 L10.61 12.95 L9.65 13.35 L9.29 15.49 L6.71 15.49 L6.35 13.35 L5.39 12.95 L3.61 14.21 L1.79 12.39 L3.05 10.61 L2.65 9.65 L0.51 9.29 L0.51 6.71 L2.65 6.35 L3.05 5.39 L1.79 3.61 L3.61 1.79 L5.39 3.05 L6.35 2.65 L6.71 0.51 L9.29 0.51 L9.65 2.65 L10.61 3.05 L12.39 1.79 L14.21 3.61 L12.95 5.39 Z M10.60 8.00 L10.40 8.99 L9.84 9.84 L8.99 10.40 L8.00 10.60 L7.01 10.40 L6.16 9.84 L5.60 8.99 L5.40 8.00 L5.60 7.01 L6.16 6.16 L7.01 5.60 L8.00 5.40 L8.99 5.60 L9.84 6.16 L10.40 7.01 Z';

function gearButton(doc: Document, label: string, onClick: () => void): HTMLButtonElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', GEAR_PATH);
  path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  const button = el(
    doc,
    'button',
    { type: 'button', className: 'starledger-gear', title: label },
    svg,
  );
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  return button;
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
    el(
      doc,
      'span',
      { className: 'starledger-head-end' },
      stateNode,
      gearButton(doc, t('menuLabel'), onConfigure),
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
