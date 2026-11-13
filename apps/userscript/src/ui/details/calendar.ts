import type { DayRange } from '@app/shared';
import { detectLang } from '../../i18n';
import { el } from '../dom';
import { formatAmount } from '../format';

export type CalendarDay = { day: string; msu: number };

// Days covered by the shown period; 'all' covers every day, undefined only the selected one
export type CalendarPeriod = { from: string; to: string } | 'all' | undefined;

const inPeriod = (day: string, selected: string, period: CalendarPeriod): boolean => {
  if (period === 'all') return true;
  if (period === undefined) return day === selected;
  return day >= period.from && day <= period.to;
};

export function shiftMonth(refDay: string, delta: number): string {
  const [y = 0, m = 1, d = 1] = refDay.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + delta, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function renderCalendar(
  doc: Document,
  days: CalendarDay[] | undefined,
  selected: string,
  onSelect: (day: string) => void,
  period?: CalendarPeriod,
  onRange?: (range: DayRange) => void,
): HTMLElement {
  const list = days ?? [];
  const max = Math.max(0, ...list.map((d) => Math.abs(d.msu)));
  const cal = el(doc, 'div', { className: 'starledger-calendar' });
  const dateFormat = new Intl.DateTimeFormat(detectLang(doc), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const cells: HTMLElement[] = [];
  const covered: number[] = [];
  for (const [index, { day, msu }] of list.entries()) {
    const height = max > 0 ? Math.round((Math.abs(msu) / max) * 100) : 0;
    const bar = el(doc, 'span', { className: 'starledger-bar' });
    bar.style.height = `${height}%`;
    const cell = el(
      doc,
      'button',
      { type: 'button', className: msu < 0 ? 'is-negative' : '', title: day },
      el(doc, 'span', { className: 'starledger-slot' }, bar),
      el(doc, 'span', {
        className: 'starledger-daynum',
        textContent: String(Number(day.slice(8))),
      }),
    );
    cell.dataset.day = day;
    // Explicit cells so the period box can overlap them in the same grid row
    cell.style.gridArea = `1 / ${index + 1}`;
    if (inPeriod(day, selected, period)) covered.push(index);
    cell.setAttribute(
      'aria-label',
      `${dateFormat.format(new Date(`${day}T00:00:00Z`))}: ${formatAmount(msu)}`,
    );
    cell.setAttribute('aria-pressed', String(day === selected));
    cell.addEventListener('click', () => onSelect(day));
    cells.push(cell);
    cal.append(cell);
  }

  const box = el(doc, 'span', { className: 'starledger-period' });
  const paint = (first?: number, last?: number) => {
    for (const [index, cell] of cells.entries()) {
      cell.classList.toggle(
        'is-in-period',
        first !== undefined && last !== undefined && index >= first && index <= last,
      );
    }
    if (first === undefined || last === undefined) {
      box.remove();
      return;
    }
    box.style.gridArea = `1 / ${first + 1} / 2 / ${last + 2}`;
    cal.append(box);
  };
  const shown = (): [number?, number?] => [covered[0], covered.at(-1)];
  paint(...shown());

  if (onRange) enableDrag(doc, cal, cells, paint, shown, onRange);
  return cal;
}

// Spec 2026-11-13 "Drag": touch keeps targeting the pressed element, so the hovered day comes from the point
function enableDrag(
  doc: Document,
  cal: HTMLElement,
  cells: HTMLElement[],
  paint: (first?: number, last?: number) => void,
  shown: () => [number?, number?],
  onRange: (range: DayRange) => void,
): void {
  let start: number | undefined;
  let current = 0;
  let swallowClick = false;

  const indexAt = (e: PointerEvent): number | undefined => {
    const hit = doc.elementFromPoint?.(e.clientX, e.clientY)?.closest<HTMLElement>('[data-day]');
    const index = hit ? cells.indexOf(hit) : -1;
    return index >= 0 ? index : undefined;
  };
  const span = (a: number, b: number): [number, number] => [Math.min(a, b), Math.max(a, b)];

  cal.addEventListener('pointerdown', (e) => {
    swallowClick = false;
    if (!e.isPrimary || e.button !== 0) return;
    const cell = (e.target as Element | null)?.closest<HTMLElement>('[data-day]');
    const index = cell ? cells.indexOf(cell) : -1;
    if (index < 0) return;
    start = current = index;
  });
  cal.addEventListener('pointermove', (e) => {
    if (start === undefined) return;
    const index = indexAt(e);
    if (index === undefined || index === current) return;
    // Captured only once the drag leaves its first day, so a plain click keeps its button target
    if (!cal.hasPointerCapture?.(e.pointerId)) cal.setPointerCapture?.(e.pointerId);
    current = index;
    paint(...span(start, current));
  });
  cal.addEventListener('pointerup', (e) => {
    if (start === undefined) return;
    const end = indexAt(e) ?? current;
    const first = start;
    start = undefined;
    if (end === first) {
      paint(...shown());
      return;
    }
    swallowClick = true;
    const [from, to] = span(first, end);
    onRange({ from: cells[from]?.dataset.day ?? '', to: cells[to]?.dataset.day ?? '' });
  });
  cal.addEventListener('pointercancel', () => {
    start = undefined;
    paint(...shown());
  });
  // A mouse drag ends with a click on the release day; keyboard clicks (detail 0) always go through
  cal.addEventListener(
    'click',
    (e) => {
      if (!swallowClick || e.detail === 0) return;
      swallowClick = false;
      e.stopPropagation();
    },
    true,
  );
}
