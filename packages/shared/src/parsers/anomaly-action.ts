import type { ParseResult } from '../events';
import type { AnomalyActionObservation } from '../observation';

const NUMBER = /\d{1,3}(?:[.,\s]\d{3})+|\d+/g;

// docs/ogame-data-formats.md §9.2: the amount is the only number of the localized lithiumBonus.message
export function lithiumBonusAmount(raw: string | null): number | null {
  if (raw === null) return null;
  let message: unknown;
  try {
    message = (JSON.parse(raw) as { message?: unknown } | null)?.message;
  } catch {
    return null;
  }
  if (typeof message !== 'string') return null;
  const text = message.replace(/<[^>]*>|&[#\w]+;/g, ' ');
  const numbers = text.match(NUMBER) ?? [];
  return numbers.length === 1 ? Number(numbers[0]?.replace(/\D/g, '')) : null;
}

export function parseAnomalyAction(obs: AnomalyActionObservation): ParseResult {
  return {
    status: 'ok',
    externalKey: `anomaly:${obs.clientObservationId}`,
    occurredAt: obs.actedAt,
    event: {
      kind: 'anomaly_action',
      action: obs.action,
      lithium: obs.lithium,
      darkMatter: obs.darkMatter,
      lithiumBonus: obs.lithiumBonus ?? lithiumBonusAmount(obs.lithiumBonusRaw),
    },
  };
}
