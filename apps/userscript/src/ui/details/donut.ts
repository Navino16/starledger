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
  resources: '#64a69b',
  darkmatter: '#b88ce8',
  nothing: '#5a6b7a',
  ships: '#6f9fc8',
  trader: '#e3b955',
  item: '#d98a4e',
  blackhole: '#2b2f3a',
  early: '#95c1dd',
  late: '#9899be',
  pirates: '#e2574c',
  aliens: '#8fd46a',
};
const FALLBACK_COLOR = '#757ba6';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function circle(doc: Document, stroke: string, attrs: Record<string, string> = {}): Element {
  const c = doc.createElementNS(SVG_NS, 'circle');
  c.setAttribute('cx', '50');
  c.setAttribute('cy', '50');
  c.setAttribute('r', String(RADIUS));
  c.setAttribute('fill', 'none');
  c.setAttribute('stroke', stroke);
  c.setAttribute('stroke-width', '16');
  for (const [k, v] of Object.entries(attrs)) c.setAttribute(k, v);
  return c;
}

export function renderDonut(
  doc: Document,
  t: T,
  outcomes: Record<string, number> | undefined,
): HTMLElement {
  const entries = Object.entries(outcomes ?? {}).filter(([, n]) => n > 0);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const lang = detectLang(doc);
  const decimal = new Intl.NumberFormat(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const percent = (ratio: number) => `${decimal.format(ratio * 100)}${lang === 'fr' ? ' %' : '%'}`;
  const root = el(doc, 'div', { className: 'starledger-donut' });
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'starledger-donut-chart');
  svg.append(circle(doc, '#1f2833'));
  const legend = el(doc, 'ul', { className: 'starledger-legend' });
  let offset = 0;
  for (const [key, n] of entries) {
    const color = COLORS[key] ?? FALLBACK_COLOR;
    const length = (n / total) * CIRCUMFERENCE;
    svg.append(
      circle(doc, color, {
        'data-outcome': key,
        'stroke-dasharray': `${length} ${CIRCUMFERENCE - length}`,
        'stroke-dashoffset': String(-offset),
        transform: 'rotate(-90 50 50)',
      }),
    );
    offset += length;
    const label = OUTCOME_KEYS[key] ? t(OUTCOME_KEYS[key]) : key;
    const swatch = el(doc, 'span', { className: 'starledger-swatch' });
    swatch.style.background = color;
    const item = el(doc, 'li', {}, swatch, `${label}: ${n} (${percent(n / total)})`);
    item.dataset.legend = key;
    legend.append(item);
  }
  const center = el(doc, 'span', {
    className: 'starledger-donut-total',
    textContent: String(total),
  });
  root.append(el(doc, 'div', { className: 'starledger-donut-wrap' }, svg, center), legend);
  return root;
}
