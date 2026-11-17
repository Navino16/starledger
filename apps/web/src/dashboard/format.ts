import { periodRange, type SiteLocale } from '@app/shared';
import { formatDate, type Translate } from '../i18n';

export type DashboardPeriod = 'day' | 'week' | 'month' | 'all';
export interface AccountRef {
  serverId: number;
  lang: string;
  playerId: number;
}

const ACCOUNT_KEY = /^(\d{1,10})-([a-z]{2,3})-(\d{1,16})$/;
const DAY_MS = 86_400_000;

export const accountKey = (a: AccountRef) => `${a.serverId}-${a.lang}-${a.playerId}`;

export function parseAccountKey(raw: string | null): AccountRef | null {
  const m = raw ? ACCOUNT_KEY.exec(raw) : null;
  if (!m) return null;
  return { serverId: Number(m[1]), lang: m[2] as string, playerId: Number(m[3]) };
}

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (date: Date) => date.toISOString().slice(0, 10);

/** The browser's local date: the site does not know the OGame server offset (spec dashboard). */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function shiftDay(day: string, period: DashboardPeriod, delta: 1 | -1): string {
  const date = toDate(day);
  if (period === 'day') return toDay(new Date(date.getTime() + delta * DAY_MS));
  if (period === 'week') return toDay(new Date(date.getTime() + delta * 7 * DAY_MS));
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return toDay(target);
}

export function monthTitle(locale: SiteLocale, day: string): string {
  const title = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(toDate(day));
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function periodTitle(
  t: Translate,
  locale: SiteLocale,
  period: DashboardPeriod,
  day: string,
): string {
  if (period === 'all') return t('dashboard.allTime');
  if (period === 'month') return monthTitle(locale, day);
  const from = period === 'week' ? (periodRange('week', day)?.from ?? day) : day;
  const date = formatDate(toDate(from), locale, { timeZone: 'UTC' });
  return period === 'week' ? t('dashboard.weekOf', { date }) : date;
}
