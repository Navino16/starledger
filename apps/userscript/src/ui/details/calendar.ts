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
): HTMLElement {
  const list = days ?? [];
  const max = Math.max(0, ...list.map((d) => Math.abs(d.msu)));
  const cal = el(doc, 'div', { className: 'starledger-calendar' });
  const dateFormat = new Intl.DateTimeFormat(detectLang(doc), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
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
    if (inPeriod(day, selected, period)) {
      cell.classList.add('is-in-period');
      covered.push(index);
    }
    cell.setAttribute(
      'aria-label',
      `${dateFormat.format(new Date(`${day}T00:00:00Z`))}: ${formatAmount(msu)}`,
    );
    cell.setAttribute('aria-pressed', String(day === selected));
    cell.addEventListener('click', () => onSelect(day));
    cal.append(cell);
  }
  const first = covered[0];
  const last = covered.at(-1);
  if (first !== undefined && last !== undefined) {
    const box = el(doc, 'span', { className: 'starledger-period' });
    box.style.gridArea = `1 / ${first + 1} / 2 / ${last + 2}`;
    cal.append(box);
  }
  return cal;
}
