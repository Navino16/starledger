import { z } from 'zod';
import { parseCoords } from '../coords';
import type { ParseResult, WreckfieldEvent } from '../events';
import type { MessageObservation } from '../observation';
import { Invalid, need, rawJson, tryBuild } from './raw';

// docs/ogame-data-formats.md §3.6
const recoveredSchema = z.record(z.string(), z.object({ amount: z.number().int().nonnegative() }));

function build(obs: MessageObservation): WreckfieldEvent {
  const coordsRaw = obs.raw.sourceplanetcoordinates;
  if (coordsRaw === undefined) throw new Invalid('missing sourceplanetcoordinates');
  const coords = parseCoords(coordsRaw);
  if (coords === null) throw new Invalid('invalid sourceplanetcoordinates');

  const recovered = need(
    rawJson(obs.raw, 'technologiesrecovered', recoveredSchema),
    'technologiesrecovered',
  );
  if (recovered === null) throw new Invalid('missing technologiesrecovered');

  const shipsRecovered = Object.fromEntries(
    Object.entries(recovered).map(([id, tech]) => [id, tech.amount]),
  );
  return { kind: 'wreckfield', coords, shipsRecovered };
}

export function parseWreckfield(obs: MessageObservation): ParseResult {
  return tryBuild(obs, build);
}
