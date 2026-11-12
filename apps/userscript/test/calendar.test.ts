import { describe, expect, it, vi } from 'vitest';
import { renderCalendar, shiftMonth } from '../src/ui/details/calendar';

const febDays = Array.from({ length: 28 }, (_, i) => ({
  day: `2026-02-${String(i + 1).padStart(2, '0')}`,
  msu: i === 2 ? -50 : (i + 1) * 10,
}));

describe('renderCalendar', () => {
  it('renders one bar per day', () => {
    const cal = renderCalendar(document, febDays, '2026-02-14', () => {});
    expect(cal.querySelectorAll('[data-day]')).toHaveLength(28);
  });

  it('marks negative days and scales heights on the largest absolute value', () => {
    const cal = renderCalendar(document, febDays, '2026-02-14', () => {});
    expect(cal.querySelector('[data-day="2026-02-03"]')?.classList.contains('is-negative')).toBe(
      true,
    );
    expect(cal.querySelector('[data-day="2026-02-04"]')?.classList.contains('is-negative')).toBe(
      false,
    );
    const bar = cal.querySelector<HTMLElement>('[data-day="2026-02-28"] .starledger-bar');
    expect(bar?.style.height).toBe('100%');
  });

  it('flags the selected day and reports clicks', () => {
    const onSelect = vi.fn();
    const cal = renderCalendar(document, febDays, '2026-02-14', onSelect);
    expect(cal.querySelector('[data-day="2026-02-14"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(cal.querySelector('[data-day="2026-02-15"]')?.getAttribute('aria-pressed')).toBe(
      'false',
    );
    cal.querySelector<HTMLElement>('[data-day="2026-02-14"]')?.click();
    expect(onSelect).toHaveBeenCalledWith('2026-02-14');
  });

  it('renders an empty calendar without NaN when days are missing or all zero', () => {
    const none = renderCalendar(document, undefined, '2026-02-14', () => {});
    expect(none.querySelectorAll('[data-day]')).toHaveLength(0);
    const zero = renderCalendar(document, [{ day: '2026-02-01', msu: 0 }], '2026-02-01', () => {});
    expect(zero.innerHTML).not.toContain('NaN');
  });
});

describe('shiftMonth', () => {
  it('keeps the day of month when it exists', () => {
    expect(shiftMonth('2026-03-15', -1)).toBe('2026-02-15');
    expect(shiftMonth('2026-12-10', 1)).toBe('2027-01-10');
  });

  it('clamps to the last day of shorter months', () => {
    expect(shiftMonth('2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('2028-01-31', 1)).toBe('2028-02-29');
    expect(shiftMonth('2026-05-31', 1)).toBe('2026-06-30');
  });
});
