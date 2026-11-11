import { z } from 'zod';
import { shipCountsSchema } from '../domain';
import type { ExpeditionEvent, ExpeditionResult, ExpeditionSize, ParseResult } from '../events';
import type { MessageObservation } from '../observation';
import { coordsOf, Invalid, need, type Raw, rawInt, rawJson, tryBuild } from './raw';

const amount = z.number().int().nonnegative();
const resourcesGainedSchema = z.object({
  metal: amount.optional(),
  crystal: amount.optional(),
  deuterium: amount.optional(),
  darkMatter: amount.optional(),
});
const technologiesSchema = z.record(z.string(), z.object({ amount }));
const itemsSchema = z.array(z.object({ id: z.string() })).min(1);
const navigationSchema = z.object({
  returnTimeAbsoluteIncreaseHours: z.number(),
  returnTimeMultiplier: z.number(),
});

// docs/ogame-data-formats.md §3.1 ("ressources" is the game's spelling)
const SIMPLE_RESULTS: Record<string, ExpeditionResult> = {
  ressources: 'resources',
  darkmatter: 'darkmatter',
  nothing: 'nothing',
  shipwrecks: 'ships',
  trader: 'trader',
  items: 'item',
  fleetLost: 'blackhole',
  combatPirates: 'pirates',
  combatAliens: 'aliens',
};

const SIZES: Record<number, ExpeditionSize> = { 2: 'small', 1: 'medium', 0: 'large' };

function classifyNavigation(raw: Raw): ExpeditionResult {
  const nav = need(rawJson(raw, 'navigation', navigationSchema), 'navigation');
  if (nav === null) throw new Invalid('missing navigation');
  // OGLight rule, docs/ogame-data-formats.md §3.1
  if (nav.returnTimeMultiplier < 1) return 'early';
  if (nav.returnTimeMultiplier > 1 || nav.returnTimeAbsoluteIncreaseHours >= 0) return 'late';
  throw new Invalid('navigation neither early nor late');
}

function build(obs: MessageObservation): ExpeditionEvent {
  const raw = obs.raw;
  const coords = coordsOf(raw);
  if (coords === null) throw new Invalid('invalid or missing coords');

  const rawResult = raw.expeditionresult;
  if (rawResult === undefined) throw new Invalid('missing expeditionresult');
  const result =
    rawResult === 'navigation'
      ? classifyNavigation(raw)
      : Object.hasOwn(SIMPLE_RESULTS, rawResult)
        ? SIMPLE_RESULTS[rawResult]
        : undefined;
  if (result === undefined) throw new Invalid(`unknown expeditionresult ${rawResult}`);

  const sizeRaw = need(rawInt(raw, 'size'), 'size');
  if (sizeRaw !== null && !Object.hasOwn(SIZES, sizeRaw)) throw new Invalid('invalid size');
  const depletion = need(rawInt(raw, 'depletion'), 'depletion');
  if (depletion !== null && (depletion < 1 || depletion > 4)) {
    throw new Invalid('invalid depletion');
  }

  // Inside a present resourcesgained, an absent key is a known 0
  const gained = need(rawJson(raw, 'resourcesgained', resourcesGainedSchema), 'resourcesgained');
  const technologies = need(
    rawJson(raw, 'technologiesgained', technologiesSchema),
    'technologiesgained',
  );
  const items = need(rawJson(raw, 'itemsgained', itemsSchema), 'itemsgained');

  return {
    kind: 'expedition',
    coords,
    result,
    size: sizeRaw === null ? null : (SIZES[sizeRaw] ?? null),
    depletion,
    resources: gained && {
      metal: gained.metal ?? 0,
      crystal: gained.crystal ?? 0,
      deuterium: gained.deuterium ?? 0,
    },
    darkMatter: gained && (gained.darkMatter ?? 0),
    shipsFound:
      technologies &&
      Object.fromEntries(Object.entries(technologies).map(([id, t]) => [id, t.amount])),
    shipsLost: need(rawJson(raw, 'shipslost', shipCountsSchema), 'shipslost'),
    itemId: items?.[0]?.id ?? null,
    lifeform: need(rawInt(raw, 'lifeform'), 'lifeform'),
    lifeformXp: need(rawInt(raw, 'lifeformgainedexperience'), 'lifeformgainedexperience'),
    artifacts: need(rawInt(raw, 'artifactsfound'), 'artifactsfound'),
  };
}

export function parseExpedition(obs: MessageObservation): ParseResult {
  return tryBuild(obs, build);
}
