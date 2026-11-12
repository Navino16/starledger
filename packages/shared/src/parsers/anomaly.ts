import { z } from 'zod';
import { parseCoords } from '../coords';
import type { AnomalyRewardEvent, ParseResult } from '../events';
import type { MessageObservation } from '../observation';
import { SHIP_TECH_NAMES } from '../ships';
import { Invalid, need, rawJson, tryBuild } from './raw';

const amount = z.number().int().nonnegative();
const lootSchema = z.array(
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('resource'), resource: z.string(), amount: amount.nullable() }),
    z.object({
      type: z.literal('ship'),
      attributes: z.array(z.string()),
      amount: amount.nullable(),
    }),
    z.object({ type: z.literal('unknown') }).passthrough(),
  ]),
);

const RESOURCES = ['metal', 'crystal', 'deuterium'] as const;
type ResourceKey = (typeof RESOURCES)[number];
const isResourceKey = (s: string): s is ResourceKey => (RESOURCES as readonly string[]).includes(s);

function build(obs: MessageObservation): AnomalyRewardEvent {
  // docs/decisions.md scope 13: raw attributes of the game would take precedence over x-loot if they appear
  const loot = need(rawJson(obs.raw, 'x-loot', lootSchema), 'x-loot');
  if (loot === null) throw new Invalid('missing x-loot');
  if (loot.length === 0) throw new Invalid('empty x-loot');

  const resources = { metal: 0, crystal: 0, deuterium: 0 };
  const ships: Record<string, number> = {};
  for (const item of loot) {
    if (item.type === 'unknown') throw new Invalid('unknown reward kind');
    if (item.amount === null) throw new Invalid('reward without amount');
    if (item.type === 'resource') {
      if (!isResourceKey(item.resource)) throw new Invalid(`unknown resource ${item.resource}`);
      resources[item.resource] += item.amount;
    } else {
      const ids = item.attributes.map((a) => SHIP_TECH_NAMES[a]).filter((v) => v !== undefined);
      const id = ids[0];
      if (id === undefined) throw new Invalid('unknown ship');
      if (new Set(ids).size > 1) throw new Invalid('ambiguous ship');
      ships[id] = (ships[id] ?? 0) + item.amount;
    }
  }

  const coordsRaw = obs.raw['x-anomalycoords'];
  const anomalyCoords = coordsRaw === undefined ? null : parseCoords(coordsRaw);
  return { kind: 'anomaly_reward', anomalyCoords, resources, ships };
}

export function parseAnomalyReward(obs: MessageObservation): ParseResult {
  return tryBuild(obs, build);
}
