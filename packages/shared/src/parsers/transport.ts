import { z } from 'zod';
import type { ParseResult, TransportDirection, TransportEvent } from '../events';
import type { MessageObservation } from '../observation';
import { Invalid, need, rawInt, rawJson, tryBuild } from './raw';

const amount = z.number().int().nonnegative();
// docs/ogame-data-formats.md §3.7: an absent resource means 0; food and unknown keys are ignored
const cargoSchema = z.object({
  metal: amount.default(0),
  crystal: amount.default(0),
  deuterium: amount.default(0),
});

function playerId(obs: MessageObservation, key: string): number {
  const id = need(rawInt(obs.raw, key), key);
  if (id === null) throw new Invalid(`missing ${key}`);
  return id;
}

function directionOf(obs: MessageObservation): TransportDirection {
  const own = obs.account.playerId;
  const sourceOwn = playerId(obs, 'sourceplayerid') === own;
  const targetOwn = playerId(obs, 'targetplayerid') === own;
  if (sourceOwn && targetOwn) return 'internal';
  if (sourceOwn) return 'delivered';
  if (targetOwn) return 'received';
  throw new Invalid('transport involves no own player');
}

function build(obs: MessageObservation): TransportEvent {
  const direction = directionOf(obs);
  const cargo = need(rawJson(obs.raw, 'cargo', cargoSchema), 'cargo');
  if (cargo === null) throw new Invalid('missing cargo');
  // docs/decisions.md scope 12: the other player's identity and coordinates stay in the raw only
  return { kind: 'transport', direction, resources: cargo };
}

export function parseTransport(obs: MessageObservation): ParseResult {
  return tryBuild(obs, build);
}
