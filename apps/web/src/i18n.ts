import type { SiteLocale } from '@app/shared';
import { useCallback } from 'react';
import { ApiError } from './api';
import en from './locales/en.json';
import fr from './locales/fr.json';
import { useSession } from './session';

export type Translate = (key: string, params?: Record<string, string | number>) => string;

const catalogs: Record<SiteLocale, unknown> = { fr, en };
const LOCALE_TAGS: Record<SiteLocale, string> = { fr: 'fr-FR', en: 'en-GB' };

export function translate(
  locale: SiteLocale,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      catalogs[locale],
    );
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''));
}

export function useT(): Translate {
  const { locale } = useSession();
  return useCallback((key, params) => translate(locale, key, params), [locale]);
}

/** « 16 nov. 2026, 14:32 » in French, « 16 Nov 2026, 14:32 » in English (docs/web-design.md, Rédaction). */
export function formatDate(
  date: Date | string,
  locale: SiteLocale,
  opts: { time?: boolean; timeZone?: string } = {},
): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  const tag = LOCALE_TAGS[locale];
  const day = new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: opts.timeZone,
  }).format(value);
  if (!opts.time) return day;
  const time = new Intl.DateTimeFormat(tag, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: opts.timeZone,
  }).format(value);
  return `${day}, ${time}`;
}

export const formatNumber = (value: number, locale: SiteLocale) =>
  new Intl.NumberFormat(LOCALE_TAGS[locale]).format(value);

/** Message for an error that no field or page handles specifically. */
export function describeError(t: Translate, error: unknown): string {
  const code = error instanceof ApiError ? error.code : null;
  if (code === 'network') return t('errors.network');
  if (code === 'rate_limited') return t('errors.rateLimited');
  if (code === 'csrf_invalid') return t('errors.csrf');
  return t('errors.generic');
}

const COMPACT_UNITS: [string, number][] = [
  ['k', 1e3],
  ['M', 1e6],
  ['G', 1e9],
];

/** « 30,6 M », « −2 M » in French, « 1.3k » in English: the userscript units (docs/web-design.md, Rédaction). */
export function formatCompact(value: number, locale: SiteLocale): string {
  const abs = Math.abs(value);
  const sign = value < 0 && Math.round(abs) > 0 ? '−' : '';
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale], { maximumFractionDigits: 1 });
  if (Math.round(abs) < 1000) return `${sign}${number.format(Math.round(abs))}`;
  const space = locale === 'fr' ? ' ' : '';
  for (const [i, [unit, divisor]] of COMPACT_UNITS.entries()) {
    const rounded = Math.round((abs / divisor) * 10) / 10;
    // 999.96k reads 1 M, not 1000 k.
    if (rounded < 1000 || i === COMPACT_UNITS.length - 1) {
      return `${sign}${number.format(rounded)}${space}${unit}`;
    }
  }
  return '';
}
