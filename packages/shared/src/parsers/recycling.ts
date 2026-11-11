import { z } from 'zod';
import { isExpeditionPosition, parseCoords } from '../coords';
import type { ParseResult, RecyclingEvent } from '../events';
import type { MessageObservation } from '../observation';
import { Invalid, need, rawJson, tryBuild } from './raw';

const amount = z.number().nonnegative();
// docs/ogame-data-formats.md §3.5: deuterium may be absent, meaning 0
const recycledSchema = z.object({
  metal: amount,
  crystal: amount,
  deuterium: amount.default(0),
});

function build(obs: MessageObservation): RecyclingEvent {
  const coordsRaw = obs.raw.targetcoordinates ?? obs.raw.coords;
  if (coordsRaw === undefined) throw new Invalid('missing coords');
  const coords = parseCoords(coordsRaw);
  if (coords === null) throw new Invalid('invalid coords');

  const resources = need(
    rawJson(obs.raw, 'recycledresources', recycledSchema),
    'recycledresources',
  );
  if (resources === null) throw new Invalid('missing recycledresources');

  return { kind: 'recycling', coords, isExpedition: isExpeditionPosition(coords), resources };
}

export function parseRecycling(obs: MessageObservation): ParseResult {
  return tryBuild(obs, build);
}
