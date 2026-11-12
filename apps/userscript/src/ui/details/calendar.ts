import { el } from '../dom';

export type CalendarDay = { day: string; msu: number };

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
): HTMLElement {
  const list = days ?? [];
  const max = Math.max(0, ...list.map((d) => Math.abs(d.msu)));
  const cal = el(doc, 'div', { className: 'starledger-calendar' });
  for (const { day, msu } of list) {
    const height = max > 0 ? Math.round((Math.abs(msu) / max) * 100) : 0;
    const bar = el(doc, 'span', { className: 'starledger-bar' });
    bar.style.height = `${height}%`;
    const cell = el(
      doc,
      'button',
      { type: 'button', className: msu < 0 ? 'is-negative' : '', title: day },
      bar,
      el(doc, 'span', {
        className: 'starledger-daynum',
        textContent: String(Number(day.slice(8))),
      }),
    );
    cell.dataset.day = day;
    cell.setAttribute('aria-pressed', String(day === selected));
    cell.addEventListener('click', () => onSelect(day));
    cal.append(cell);
  }
  return cal;
}
