import type { ParseResult } from '../events';
import type { AnomalyActionObservation } from '../observation';

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
      lithiumBonus: obs.lithiumBonus,
    },
  };
}
