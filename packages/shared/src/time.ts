export type Period = 'day' | 'week' | 'month' | 'all';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

function formatUtcDate(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseDayKey(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year as number, (month as number) - 1, date as number));
}

export function dayKey(epochMs: number, serverUtcOffsetMinutes: number): string {
  return formatUtcDate(new Date(epochMs + serverUtcOffsetMinutes * MINUTE_MS));
}

export function computeServerUtcOffsetMinutes(
  serverTimeMs: number,
  nowMs: number,
  browserUtcOffsetMinutes: number,
): number {
  const gapMinutes = (serverTimeMs - nowMs) / MINUTE_MS;
  return Math.round(gapMinutes / 15) * 15 + browserUtcOffsetMinutes;
}

export function periodRange(period: Period, today: string): { from: string; to: string } | null {
  if (period === 'all') return null;
  const base = parseDayKey(today);
  if (period === 'day') return { from: today, to: today };
  if (period === 'week') {
    const sinceMonday = (base.getUTCDay() + 6) % 7;
    const monday = base.getTime() - sinceMonday * DAY_MS;
    return {
      from: formatUtcDate(new Date(monday)),
      to: formatUtcDate(new Date(monday + 6 * DAY_MS)),
    };
  }
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  return {
    from: formatUtcDate(new Date(Date.UTC(year, month, 1))),
    to: formatUtcDate(new Date(Date.UTC(year, month + 1, 0))),
  };
}
