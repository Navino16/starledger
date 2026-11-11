import en from './locales/en.json';
import fr from './locales/fr.json';

export type Locale = 'fr' | 'en';
export type Translate = (key: string, params?: Record<string, string>) => string;

const catalogs: Record<Locale, unknown> = { fr, en };

export function negotiateLocale(header: string | undefined): Locale {
  const ranked = (header ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => /^\s*q=([\d.]+)/.exec(p)?.[1]).find(Boolean);
      return { lang: tag.trim().toLowerCase().split('-')[0], q: q === undefined ? 1 : Number(q) };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);
  const match = ranked.find((entry) => entry.lang === 'fr' || entry.lang === 'en');
  return match?.lang === 'fr' ? 'fr' : 'en';
}

export function translator(locale: Locale): Translate {
  return (key, params = {}) => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        catalogs[locale],
      );
    if (typeof value !== 'string') return key;
    return value.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? '');
  };
}
