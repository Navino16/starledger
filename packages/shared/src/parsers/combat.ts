import { z } from 'zod';
import { isExpeditionPosition } from '../coords';
import { type Resources, shipCountsSchema } from '../domain';
import type { CombatEvent, CombatOutcome, ParseResult, ShortCombatEvent } from '../events';
import type { MessageObservation } from '../observation';
import { PROBE_ID } from '../ships';
import { coordsOf, Invalid, need, rawJson, tryBuild } from './raw';

const id = z.number().int();
const amount = z.number().nonnegative();
// Any resource name: the game also lists `food` (docs/ogame-data-formats.md §3.3)
const resource = z.string();

const defenderSchema = z.object({ owner: z.object({ id }).optional() });
const fleetsSchema = z.array(
  z.object({
    fleetId: id,
    side: z.enum(['attacker', 'defender']),
    player: z.object({ id }).optional(),
    combatTechnologies: z.array(z.object({ technologyId: id })),
  }),
);
const roundsSchema = z.array(
  z.object({
    fleets: z.array(
      z.object({
        fleetId: id,
        technologies: z.array(z.object({ technologyId: id, destroyedTotal: amount })),
      }),
    ),
  }),
);
const resultSchema = z.object({
  winner: z.enum(['attacker', 'defender', 'none']),
  loot: z.object({ resources: z.array(z.object({ resource, amount })) }).optional(),
  debris: z.object({ resources: z.array(z.object({ resource, total: amount })) }).optional(),
  repairedTechnologies: z.array(z.object({ technologyId: id, amount })).optional(),
});

const isShip = (technologyId: number) => technologyId >= 200 && technologyId < 300;

function required<T>(value: T | null, attr: string): T {
  if (value === null) throw new Invalid(`missing ${attr}`);
  return value;
}

function sumResources(entries: { resource: string; value: number }[]): Resources {
  const total: Resources = { metal: 0, crystal: 0, deuterium: 0 };
  for (const { resource: r, value } of entries) {
    if (r === 'metal' || r === 'crystal' || r === 'deuterium') total[r] += value;
  }
  return total;
}

function outcomeOf(
  winner: 'attacker' | 'defender' | 'none',
  ownSide: 'attacker' | 'defender',
): CombatOutcome {
  if (winner === 'none') return 'draw';
  return winner === ownSide ? 'won' : 'lost';
}

function build(obs: MessageObservation): CombatEvent {
  const raw = obs.raw;
  const coords = coordsOf(raw);
  if (coords === null) throw new Invalid('invalid or missing coords');

  const defender = required(
    need(rawJson(raw, 'defenderspaceobject', defenderSchema), 'defenderspaceobject'),
    'defenderspaceobject',
  );
  const fleets = required(need(rawJson(raw, 'fleets', fleetsSchema), 'fleets'), 'fleets');
  const rounds = required(
    need(rawJson(raw, 'combatrounds', roundsSchema), 'combatrounds'),
    'combatrounds',
  );
  const result = required(need(rawJson(raw, 'result', resultSchema), 'result'), 'result');

  const ownId = obs.account.playerId;
  const ownFleets = fleets.filter((f) => f.player?.id === ownId);
  const ownPlanetDefended = defender.owner?.id === ownId;
  const ownSide = ownFleets[0]?.side ?? (ownPlanetDefended ? 'defender' : null);
  if (ownSide === null) throw new Invalid('own side not found');

  const outcome = outcomeOf(result.winner, ownSide);
  const isExpedition = isExpeditionPosition(coords);
  // docs/ogame-data-formats.md §3.3: sign derived by us, 0 for expedition fights
  let lootSign: 1 | -1 | 0 = 0;
  if (!isExpedition) {
    if (ownSide === 'attacker' && outcome === 'won') lootSign = 1;
    else if (ownPlanetDefended && result.winner === 'attacker') lootSign = -1;
  }

  // The game writes empty lists as `[]` (docs/ogame-data-formats.md §3.3); fallback kept by decision
  const loot = result.loot ?? { resources: [] };
  const debris = result.debris ?? { resources: [] };

  const ownIds = new Set(ownFleets.map((f) => f.fleetId));
  const lost: Record<string, number> = {};
  for (const f of rounds.at(-1)?.fleets ?? []) {
    if (!ownIds.has(f.fleetId)) continue;
    for (const t of f.technologies) {
      if (isShip(t.technologyId)) {
        lost[t.technologyId] = (lost[t.technologyId] ?? 0) + t.destroyedTotal;
      }
    }
  }
  if (ownPlanetDefended) {
    for (const t of result.repairedTechnologies ?? []) {
      const destroyed = lost[t.technologyId];
      if (destroyed !== undefined) {
        lost[t.technologyId] = Math.max(0, destroyed - t.amount);
      }
    }
  }
  const shipsLost = Object.fromEntries(Object.entries(lost).filter(([, n]) => n > 0));

  const attackers = fleets.filter((f) => f.side === 'attacker');
  const isProbeOnly =
    attackers.length > 0 &&
    attackers.every(
      (f) =>
        f.combatTechnologies.length > 0 &&
        f.combatTechnologies.every((t) => String(t.technologyId) === PROBE_ID),
    );

  return {
    kind: 'combat',
    coords,
    isExpedition,
    isProbeOnly,
    ownSide,
    ownPlanetDefended,
    outcome,
    loot: sumResources(loot.resources.map((r) => ({ resource: r.resource, value: r.amount }))),
    lootSign,
    debrisCreated: sumResources(
      debris.resources.map((r) => ({ resource: r.resource, value: r.total })),
    ),
    shipsLost,
  };
}

function buildShort(obs: MessageObservation): ShortCombatEvent {
  const coords = coordsOf(obs.raw);
  if (coords === null) throw new Invalid('invalid or missing coords');
  const shipsLost = required(
    need(rawJson(obs.raw, 'shipslost', shipCountsSchema), 'shipslost'),
    'shipslost',
  );
  const keys = Object.keys(shipsLost);
  return {
    kind: 'combat_short',
    coords,
    isExpedition: isExpeditionPosition(coords),
    // docs/ogame-data-formats.md §3.4: probe-only when shipslost has only key 210
    isProbeOnly: keys.length === 1 && keys[0] === PROBE_ID,
    shipsLost,
  };
}

export function parseCombat(obs: MessageObservation): ParseResult {
  return tryBuild(obs, build);
}

export function parseShortCombat(obs: MessageObservation): ParseResult {
  return tryBuild(obs, buildShort);
}
