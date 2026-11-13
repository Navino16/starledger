import type { ParseResult } from '../events';
import type { MessageObservation, Observation } from '../observation';
import { parseAnomalyReward } from './anomaly';
import { parseAnomalyAction } from './anomaly-action';
import { parseCombat, parseShortCombat } from './combat';
import { parseExpedition } from './expedition';
import { parseFleetDispatch } from './fuel';
import { parseLifeformDiscovery } from './lifeform';
import { occurredAtOf, unrecognized } from './raw';
import { parseRecycling } from './recycling';
import { parseTransport } from './transport';
import { parseWreckfield } from './wreckfield';

export const PARSER_VERSION = 7;

// Type 34 (fleet arrivals) is not collected: never a trade (docs/ogame-data-formats.md §3.7).
export const TRACKED_MESSAGE_TYPES = [25, 32, 33, 41, 48, 54, 61, 76] as const;

const PARSERS = new Map<number, (obs: MessageObservation) => ParseResult>([
  [25, parseCombat],
  [32, parseRecycling],
  [33, parseTransport],
  [41, parseExpedition],
  [48, parseShortCombat],
  [54, parseWreckfield],
  [61, parseLifeformDiscovery],
  [76, parseAnomalyReward],
]);

export function parseMessage(obs: MessageObservation): ParseResult {
  const parser = obs.messageType === null ? undefined : PARSERS.get(obs.messageType);
  if (parser === undefined) {
    return unrecognized(obs, `unsupported message type ${obs.messageType}`, occurredAtOf(obs.raw));
  }
  return parser(obs);
}

export function parseObservation(obs: Observation): ParseResult {
  switch (obs.kind) {
    case 'message':
      return parseMessage(obs);
    case 'fleet_dispatch':
      return parseFleetDispatch(obs);
    case 'anomaly_action':
      return parseAnomalyAction(obs);
    default: {
      const unreachable: never = obs;
      return unreachable;
    }
  }
}

export function observationExternalKey(obs: Observation): string {
  switch (obs.kind) {
    case 'message':
      return `msg:${obs.msgId}`;
    case 'fleet_dispatch':
      return `fuel:${obs.clientObservationId}`;
    case 'anomaly_action':
      return `anomaly:${obs.clientObservationId}`;
    default: {
      const unreachable: never = obs;
      return unreachable;
    }
  }
}
