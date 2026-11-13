import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('keeps a 4px bar for any non-zero day, however small against the month', () => {
    const days = [
      { day: '2026-11-01', msu: -8e9 },
      { day: '2026-11-02', msu: -180e3 },
      { day: '2026-11-03', msu: 6e6 },
      { day: '2026-11-04', msu: 0 },
    ];
    const bar = (day: string) =>
      renderCalendar(document, days, '2026-11-01', () => {}).querySelector<HTMLElement>(
        `[data-day="${day}"] .starledger-bar`,
      );
    expect(bar('2026-11-02')?.style.height).toBe('0%');
    expect(bar('2026-11-02')?.style.minHeight).toBe('4px');
    expect(bar('2026-11-03')?.style.minHeight).toBe('4px');
    expect(bar('2026-11-04')?.style.minHeight).toBe('');
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

  it('marks the days of the shown period', () => {
    const marked = (period: Parameters<typeof renderCalendar>[4]) =>
      [
        ...renderCalendar(
          document,
          febDays,
          '2026-02-14',
          () => {},
          period,
        ).querySelectorAll<HTMLElement>('.is-in-period'),
      ].map((b) => b.dataset.day);
    expect(marked(undefined)).toEqual(['2026-02-14']);
    expect(marked({ from: '2026-02-09', to: '2026-02-15' })).toEqual([
      '2026-02-09',
      '2026-02-10',
      '2026-02-11',
      '2026-02-12',
      '2026-02-13',
      '2026-02-14',
      '2026-02-15',
    ]);
    expect(marked('all')).toHaveLength(febDays.length);
  });

  it('draws one box from the first to the last day of the period', () => {
    const cal = renderCalendar(document, febDays, '2026-02-14', () => {}, {
      from: '2026-02-09',
      to: '2026-02-15',
    });
    const boxes = cal.querySelectorAll<HTMLElement>('.starledger-period');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.style.gridArea).toBe('1 / 9 / 2 / 16');
    expect(cal.querySelector<HTMLElement>('[data-day="2026-02-09"]')?.style.gridArea).toBe('1 / 9');
  });

  it('draws no box when the period has no day in the month', () => {
    const cal = renderCalendar(document, febDays, '2026-02-14', () => {}, {
      from: '2026-03-02',
      to: '2026-03-08',
    });
    expect(cal.querySelector('.starledger-period')).toBeNull();
  });

  it('renders an empty calendar without NaN when days are missing or all zero', () => {
    const none = renderCalendar(document, undefined, '2026-02-14', () => {});
    expect(none.querySelectorAll('[data-day]')).toHaveLength(0);
    const zero = renderCalendar(document, [{ day: '2026-02-01', msu: 0 }], '2026-02-01', () => {});
    expect(zero.innerHTML).not.toContain('NaN');
    const bars = [...zero.querySelectorAll<HTMLElement>('.starledger-bar')];
    expect(bars.every((b) => b.style.height === '0%')).toBe(true);
  });

  it('labels each day button with its localized date and amount', () => {
    document.head.innerHTML = '<meta name="ogame-language" content="en">';
    const cal = renderCalendar(document, febDays, '2026-02-14', () => {});
    expect(cal.querySelector('[data-day="2026-02-28"]')?.getAttribute('aria-label')).toBe(
      'February 28: 280',
    );
    expect(cal.querySelector('[data-day="2026-02-03"]')?.getAttribute('aria-label')).toBe(
      'February 3: -50',
    );
    document.head.innerHTML = '';
  });
});

describe('drag', () => {
  const cellOf = (cal: HTMLElement, day: number) =>
    cal.querySelector<HTMLElement>(`[data-day="2026-02-${String(day).padStart(2, '0')}"]`);

  // jsdom has no layout: the element under the pointer is whatever the test says
  const pointer = (
    cal: HTMLElement,
    type: string,
    under: Element | null,
    init: PointerEventInit = {},
  ) => {
    document.elementFromPoint = () => under;
    const target = type === 'pointerdown' && under ? under : cal;
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, isPrimary: true, button: 0, pointerId: 1, ...init }),
    );
  };

  const mouseClick = (target: Element | null) =>
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

  const setup = () => {
    const onSelect = vi.fn();
    const onRange = vi.fn();
    const cal = renderCalendar(document, febDays, '2026-02-14', onSelect, undefined, onRange);
    document.body.append(cal);
    return { cal, onSelect, onRange };
  };

  afterEach(() => {
    document.body.replaceChildren();
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  it('reports the dragged span once and swallows the click that follows', () => {
    const { cal, onSelect, onRange } = setup();
    pointer(cal, 'pointerdown', cellOf(cal, 4));
    pointer(cal, 'pointermove', cellOf(cal, 8));
    pointer(cal, 'pointermove', cellOf(cal, 11));
    expect(cal.querySelector<HTMLElement>('.starledger-period')?.style.gridArea).toBe(
      '1 / 4 / 2 / 12',
    );
    pointer(cal, 'pointerup', cellOf(cal, 11));
    mouseClick(cellOf(cal, 11));
    expect(onRange).toHaveBeenCalledTimes(1);
    expect(onRange).toHaveBeenCalledWith({ from: '2026-02-04', to: '2026-02-11' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('sorts the bounds of a right to left drag', () => {
    const { cal, onRange } = setup();
    pointer(cal, 'pointerdown', cellOf(cal, 11));
    pointer(cal, 'pointermove', cellOf(cal, 4));
    pointer(cal, 'pointerup', cellOf(cal, 4));
    expect(onRange).toHaveBeenCalledWith({ from: '2026-02-04', to: '2026-02-11' });
  });

  it('ends on the last hovered day when released outside the calendar', () => {
    const { cal, onRange } = setup();
    pointer(cal, 'pointerdown', cellOf(cal, 4));
    pointer(cal, 'pointermove', cellOf(cal, 9));
    pointer(cal, 'pointermove', document.body);
    pointer(cal, 'pointerup', document.body);
    expect(onRange).toHaveBeenCalledWith({ from: '2026-02-04', to: '2026-02-09' });
  });

  it('restores the shown period on pointercancel', () => {
    const { cal, onSelect, onRange } = setup();
    pointer(cal, 'pointerdown', cellOf(cal, 4));
    pointer(cal, 'pointermove', cellOf(cal, 9));
    pointer(cal, 'pointercancel', null);
    pointer(cal, 'pointerup', cellOf(cal, 9));
    expect(onRange).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(cal.querySelector<HTMLElement>('.starledger-period')?.style.gridArea).toBe(
      '1 / 14 / 2 / 15',
    );
    expect(
      [...cal.querySelectorAll<HTMLElement>('.is-in-period')].map((c) => c.dataset.day),
    ).toEqual(['2026-02-14']);
  });

  it('restores the shown period when a drag comes back to its first day', () => {
    const { cal, onRange } = setup();
    pointer(cal, 'pointerdown', cellOf(cal, 4));
    pointer(cal, 'pointermove', cellOf(cal, 9));
    pointer(cal, 'pointermove', cellOf(cal, 4));
    pointer(cal, 'pointerup', cellOf(cal, 4));
    expect(onRange).not.toHaveBeenCalled();
    expect(
      [...cal.querySelectorAll<HTMLElement>('.is-in-period')].map((c) => c.dataset.day),
    ).toEqual(['2026-02-14']);
  });

  it('keeps a press and release on one day as a plain day click', () => {
    const { cal, onSelect, onRange } = setup();
    pointer(cal, 'pointerdown', cellOf(cal, 6));
    pointer(cal, 'pointerup', cellOf(cal, 6));
    mouseClick(cellOf(cal, 6));
    expect(onRange).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('2026-02-06');
  });

  it('ignores the secondary button', () => {
    const { cal, onRange } = setup();
    pointer(cal, 'pointerdown', cellOf(cal, 4), { button: 2 });
    pointer(cal, 'pointermove', cellOf(cal, 9));
    pointer(cal, 'pointerup', cellOf(cal, 9));
    expect(onRange).not.toHaveBeenCalled();
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
