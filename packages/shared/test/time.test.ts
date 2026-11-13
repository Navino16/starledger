import { describe, expect, it } from 'vitest';
import { computeServerUtcOffsetMinutes, dayKey, periodRange } from '../src/time';

describe('dayKey', () => {
  const nearMidnight = Date.UTC(2026, 10, 10, 23, 30);

  it('applies the server offset', () => {
    expect(dayKey(nearMidnight, 60)).toBe('2026-11-11');
    expect(dayKey(nearMidnight, 0)).toBe('2026-11-10');
  });

  it('zero-pads month and day', () => {
    expect(dayKey(Date.UTC(2026, 0, 5, 12), 0)).toBe('2026-01-05');
  });

  it('handles negative offsets', () => {
    expect(dayKey(Date.UTC(2026, 0, 1, 2), -300)).toBe('2025-12-31');
  });
});

describe('computeServerUtcOffsetMinutes', () => {
  const now = Date.UTC(2026, 10, 10, 12, 0, 0);
  const sixHours = 6 * 3_600_000;

  it('combines the rounded clock gap with the browser offset', () => {
    expect(computeServerUtcOffsetMinutes(now + sixHours + 40_000, now, -300)).toBe(60);
    expect(computeServerUtcOffsetMinutes(now + sixHours - 40_000, now, -300)).toBe(60);
  });

  it('handles a negative gap', () => {
    expect(computeServerUtcOffsetMinutes(now - 2 * 3_600_000 + 20_000, now, 60)).toBe(-60);
  });

  it('rounds to the nearest quarter hour', () => {
    expect(computeServerUtcOffsetMinutes(now + 7 * 60_000, now, 0)).toBe(0);
    expect(computeServerUtcOffsetMinutes(now + 8 * 60_000, now, 0)).toBe(15);
    expect(computeServerUtcOffsetMinutes(now - 7 * 60_000, now, 0)).toBe(0);
    expect(computeServerUtcOffsetMinutes(now - 8 * 60_000, now, 0)).toBe(-15);
  });

  it('gives the same day key from browsers in different timezones', () => {
    const serverOffset = 60;
    const event = Date.UTC(2026, 10, 10, 23, 30);
    const viewers = [-300, 0, 540];
    const keys = viewers.map((browserOffset) => {
      const now = Date.UTC(2026, 10, 11, 8, 0, 0);
      const serverTime = now + (serverOffset - browserOffset) * 60_000 + 25_000;
      return dayKey(event, computeServerUtcOffsetMinutes(serverTime, now, browserOffset));
    });
    expect(keys).toEqual(['2026-11-11', '2026-11-11', '2026-11-11']);
  });
});

describe('periodRange', () => {
  it('returns Monday to Sunday for a week', () => {
    expect(periodRange('week', '2026-11-11')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(periodRange('week', '2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(periodRange('week', '2026-11-09')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
  });

  it('returns the calendar month', () => {
    expect(periodRange('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('returns the single day', () => {
    expect(periodRange('day', '2026-11-11')).toEqual({ from: '2026-11-11', to: '2026-11-11' });
  });

  it('crosses month and year boundaries for weeks', () => {
    expect(periodRange('week', '2026-12-31')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
  });

  it('returns null for all', () => {
    expect(periodRange('all', '2026-11-11')).toBeNull();
  });

  it('returns the given bounds for a custom period', () => {
    const span = { from: '2026-11-04', to: '2026-11-11' };
    expect(periodRange('custom', '2026-11-13', span)).toEqual(span);
  });

  it('throws for a custom period without bounds', () => {
    expect(() => periodRange('custom', '2026-11-13')).toThrow('custom period needs bounds');
  });
});
