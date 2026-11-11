import { shipCountsSchema } from '../domain';
import type {
  ArtifactsSize,
  LifeformDiscoveryEvent,
  LifeformDiscoveryResult,
  ParseResult,
} from '../events';
import type { MessageObservation } from '../observation';
import { coordsOf, Invalid, need, rawInt, rawJson, tryBuild } from './raw';

// docs/ogame-data-formats.md §3.2
const TYPES: Record<string, LifeformDiscoveryResult> = {
  none: 'none',
  artifacts: 'artifacts',
  'lifeform-xp': 'lifeform_xp',
  'ship-lost': 'ship_lost',
  'lifeform-found': 'lifeform_found',
};
const ARTIFACT_SIZES: readonly string[] = ['normal', 'big', 'huge', 'full'];

function build(obs: MessageObservation): LifeformDiscoveryEvent {
  const raw = obs.raw;
  const coords = coordsOf(raw);
  if (coords === null) throw new Invalid('invalid or missing coords');

  const artifacts = need(rawInt(raw, 'artifactsfound'), 'artifactsfound');
  const xp = need(rawInt(raw, 'lifeformgainedexperience'), 'lifeformgainedexperience');
  const lifeform = need(rawInt(raw, 'lifeform'), 'lifeform');
  const shipsLost = need(rawJson(raw, 'shipslost', shipCountsSchema), 'shipslost');

  const sizeRaw = raw.artifactssize;
  if (sizeRaw !== undefined && !ARTIFACT_SIZES.includes(sizeRaw)) {
    throw new Invalid('invalid artifactssize');
  }

  const typeRaw = raw.discoverytype;
  let result: LifeformDiscoveryResult;
  if (typeRaw === undefined) {
    // OGLight rule when discoverytype is absent, docs/ogame-data-formats.md §3.2
    if ((artifacts ?? 0) > 0) result = 'artifacts';
    else if ((xp ?? 0) > 0) result = 'lifeform_xp';
    else result = 'none';
  } else {
    const mapped = Object.hasOwn(TYPES, typeRaw) ? TYPES[typeRaw] : undefined;
    if (mapped === undefined) throw new Invalid(`unknown discoverytype ${typeRaw}`);
    result = mapped;
  }

  return {
    kind: 'lifeform_discovery',
    coords,
    result,
    lifeform,
    xp,
    artifacts,
    artifactsSize: (sizeRaw as ArtifactsSize | undefined) ?? null,
    shipsLost,
  };
}

export function parseLifeformDiscovery(obs: MessageObservation): ParseResult {
  return tryBuild(obs, build);
}
