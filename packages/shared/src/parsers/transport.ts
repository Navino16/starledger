import { z } from 'zod';
import { parseCoords } from '../coords';
import type { ParseResult, TransportDirection, TransportEvent, TransportPartner } from '../events';
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

function partnerOf(obs: MessageObservation, side: 'source' | 'target'): TransportPartner {
  const id = playerId(obs, `${side}playerid`);
  const name = obs.raw[`${side}playername`]?.trim();
  if (!name) throw new Invalid(`missing ${side}playername`);
  const coords = parseCoords(obs.raw[`${side}planetcoordinates`] ?? '');
  if (!coords) throw new Invalid(`invalid ${side}planetcoordinates`);
  const type = need(rawInt(obs.raw, `${side}planettype`), `${side}planettype`);
  if (type !== 1 && type !== 3) throw new Invalid(`invalid ${side}planettype`);
  return { playerId: id, playerName: name, coords: { ...coords, type } };
}

function build(obs: MessageObservation): TransportEvent {
  const direction = directionOf(obs);
  const cargo = need(rawJson(obs.raw, 'cargo', cargoSchema), 'cargo');
  if (cargo === null) throw new Invalid('missing cargo');
  // User decision 2026-11-12 (docs/decisions.md): to review before publishing (scope 14, ToolDev answer)
  const partner =
    direction === 'internal'
      ? null
      : partnerOf(obs, direction === 'delivered' ? 'target' : 'source');
  return { kind: 'transport', direction, resources: cargo, partner };
}

export function parseTransport(obs: MessageObservation): ParseResult {
  return tryBuild(obs, build);
}
