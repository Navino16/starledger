import type { ParseResult } from '../events';
import type { FleetDispatchObservation } from '../observation';

export function parseFleetDispatch(obs: FleetDispatchObservation): ParseResult {
  return {
    status: 'ok',
    externalKey: `fuel:${obs.clientObservationId}`,
    occurredAt: obs.sentAt,
    event: {
      kind: 'fuel',
      source: obs.source,
      mission: obs.mission,
      origin: obs.origin,
      target: obs.target,
      ships: obs.ships,
      consumption: obs.consumption === null ? null : Math.trunc(obs.consumption),
    },
  };
}
