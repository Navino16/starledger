import { detectLang, type MessageKey, type T } from '../../i18n';
import { el } from '../dom';

export const OUTCOME_KEYS: Record<string, MessageKey> = {
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

const COLORS: Record<string, string> = {
  resources: '#9fe0f5',
  darkmatter: '#b88ce8',
  nothing: '#e6e6e6',
  ships: '#6fcf97',
  trader: '#5b8def',
  item: '#c98a5a',
  blackhole: '#8a8f9c',
  early: '#ef8fb0',
  late: '#e2574c',
  pirates: '#f0d34a',
  aliens: '#e0903a',
};
const FALLBACK_COLOR = '#757ba6';

const SVG_NS = 'http://www.w3.org/2000/svg';
const OUTER = 48;
const INNER = 32;
const STEP = Math.PI / 90;

const point = (r: number, angle: number) =>
  `${(50 + r * Math.cos(angle)).toFixed(2)} ${(50 + r * Math.sin(angle)).toFixed(2)}`;

// Ring sectors as straight-edged polygons: no stroke dashes nor arc commands, which some renderers drop
export function sectorPath(from: number, to: number): string {
  const a0 = from * 2 * Math.PI - Math.PI / 2;
  const a1 = to * 2 * Math.PI - Math.PI / 2;
  const steps = Math.max(1, Math.ceil((a1 - a0) / STEP));
  const angles = Array.from({ length: steps + 1 }, (_, i) => a0 + ((a1 - a0) * i) / steps);
  const outer = angles.map((a) => point(OUTER, a));
  const inner = angles.reverse().map((a) => point(INNER, a));
  return `M ${outer.join(' L ')} L ${inner.join(' L ')} Z`;
}

function svgNode(doc: Document, tag: string, attrs: Record<string, string>): Element {
  const node = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function renderDonut(
  doc: Document,
  t: T,
  outcomes: Record<string, number> | undefined,
): HTMLElement {
  const entries = Object.entries(outcomes ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const lang = detectLang(doc);
  const decimal = new Intl.NumberFormat(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const percent = (ratio: number) => `${decimal.format(ratio * 100)}${lang === 'fr' ? ' %' : '%'}`;
  const root = el(doc, 'div', { className: 'starledger-donut' });
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'starledger-donut-chart');
  svg.append(
    svgNode(doc, 'circle', {
      cx: '50',
      cy: '50',
      r: String((OUTER + INNER) / 2),
      fill: 'none',
      stroke: '#262d39',
      'stroke-width': String(OUTER - INNER),
    }),
  );
  const legend = el(doc, 'ul', { className: 'starledger-legend' });
  let done = 0;
  const summaries: string[] = [];
  for (const [key, n] of entries) {
    const color = COLORS[key] ?? FALLBACK_COLOR;
    const label = OUTCOME_KEYS[key] ? t(OUTCOME_KEYS[key]) : key;
    const summary = `${label} ${n} (${percent(n / total)})`;
    summaries.push(summary);
    const arc = svgNode(doc, 'path', {
      'data-outcome': key,
      d: sectorPath(done / total, (done + n) / total),
      fill: color,
    });
    const title = doc.createElementNS(SVG_NS, 'title');
    title.textContent = summary;
    arc.append(title);
    svg.append(arc);
    done += n;
    const swatch = el(doc, 'span', { className: 'starledger-swatch' });
    swatch.style.background = color;
    const item = el(
      doc,
      'li',
      {},
      swatch,
      el(doc, 'span', { className: 'starledger-legend-label', textContent: label }),
      el(doc, 'b', { textContent: String(n) }),
      el(doc, 'small', { textContent: percent(n / total) }),
    );
    item.dataset.legend = key;
    legend.append(item);
  }
  const emptyLabel = outcomes === undefined ? '?' : t('noExpedition');
  svg.setAttribute('aria-label', summaries.length > 0 ? summaries.join(', ') : emptyLabel);
  const center = el(doc, 'span', {
    className: 'starledger-donut-total',
    textContent: outcomes === undefined ? '?' : String(total),
  });
  const middle = el(
    doc,
    'span',
    { className: 'starledger-donut-center' },
    center,
    el(doc, 'small', { textContent: t('donutCaption') }),
  );
  root.append(el(doc, 'div', { className: 'starledger-donut-wrap' }, svg, middle), legend);
  return root;
}
