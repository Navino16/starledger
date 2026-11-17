import { describe, expect, it } from 'vitest';
import { accountKey, parseAccountKey, periodTitle, shiftDay } from '../src/dashboard/format';
import { formatCompact, translate } from '../src/i18n';

const tFr = (key: string, params?: Record<string, string | number>) => translate('fr', key, params);

describe('formatCompact', () => {
  it('uses k, M, G with the locale separator and a typographic minus', () => {
    expect(formatCompact(30_612_345, 'fr')).toBe('30,6\u00a0M');
    expect(formatCompact(-2_000_000, 'fr')).toBe('−2\u00a0M');
    expect(formatCompact(950, 'en')).toBe('950');
    expect(formatCompact(1_250, 'en')).toBe('1.3k');
    expect(formatCompact(4_200_000_000, 'en')).toBe('4.2G');
    expect(formatCompact(0, 'fr')).toBe('0');
  });
});

describe('account keys', () => {
  it('round-trips a well-formed key', () => {
    expect(parseAccountKey('285-fr-123')).toEqual({ serverId: 285, lang: 'fr', playerId: 123 });
    expect(accountKey({ serverId: 285, lang: 'fr', playerId: 123 })).toBe('285-fr-123');
  });

  it('rejects anything else', () => {
    for (const raw of ['285-FR-1', 'x', '', '285-fr-', '1-fr-1-2', null]) {
      expect(parseAccountKey(raw), String(raw)).toBeNull();
    }
  });
});

describe('shiftDay', () => {
  it('moves by the period, clamping to the end of shorter months', () => {
    expect(shiftDay('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(shiftDay('2026-11-17', 'all', -1)).toBe('2026-10-17');
    expect(shiftDay('2026-11-17', 'week', -1)).toBe('2026-11-10');
    expect(shiftDay('2026-12-31', 'day', 1)).toBe('2027-01-01');
  });
});

describe('periodTitle', () => {
  it('names the period', () => {
    expect(periodTitle(tFr, 'fr', 'month', '2026-11-17')).toBe('Novembre 2026');
    expect(periodTitle(tFr, 'fr', 'week', '2026-11-18')).toBe('Semaine du 16 nov. 2026');
    expect(periodTitle(tFr, 'fr', 'day', '2026-11-17')).toBe('17 nov. 2026');
    expect(periodTitle(tFr, 'fr', 'all', '2026-11-17')).toBe("Tout l'historique");
  });
});
