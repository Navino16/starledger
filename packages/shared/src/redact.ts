import type { MessageObservation, Observation } from './observation';

type Raw = MessageObservation['raw'];
type Json = Record<string, unknown>;

const COMBAT = 25;
const COMBAT_SHORT = 48;
const TRANSPORT = 33;
const ANOMALY_REWARD = 76;

const TRANSPORT_SIDE_FIELDS = [
  'playerid',
  'playername',
  'planetid',
  'planetname',
  'planetcoordinates',
  'planettype',
  'planeticon',
];

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const idOf = (v: unknown): unknown => (isObject(v) ? v.id : undefined);

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function redactFleets(raw: Raw, own: number): void {
  const fleets = raw.fleets === undefined ? undefined : parseJson(raw.fleets);
  if (raw.fleets === undefined) return;
  if (!Array.isArray(fleets)) {
    delete raw.fleets;
    return;
  }
  let changed = false;
  const out = fleets.map((entry) => {
    if (!isObject(entry) || idOf(entry.player) === own) return entry;
    const { player, spaceObject, combatResearchPercentage, ...rest } = entry;
    if (
      player !== undefined ||
      spaceObject !== undefined ||
      combatResearchPercentage !== undefined
    ) {
      changed = true;
    }
    return rest;
  });
  if (changed) raw.fleets = JSON.stringify(out);
}

function redactDefender(raw: Raw, own: number): void {
  if (raw.defenderspaceobject === undefined) return;
  const defender = parseJson(raw.defenderspaceobject);
  if (!isObject(defender)) {
    delete raw.defenderspaceobject;
    return;
  }
  if (defender.type === 'anomaly' || idOf(defender.owner) === own) return;
  raw.defenderspaceobject = JSON.stringify({
    type: defender.type,
    coordinates: defender.coordinates,
  });
}

function redactTransport(raw: Raw, own: number): void {
  for (const side of ['source', 'target']) {
    if (raw[`${side}playerid`] === String(own)) continue;
    for (const field of TRANSPORT_SIDE_FIELDS) delete raw[`${side}${field}`];
  }
}

function redactAnomalyReward(raw: Raw, own: number): void {
  if (raw.targetplayerid === String(own)) return;
  for (const key of Object.keys(raw)) {
    if (key.startsWith('targetplayer') || key.startsWith('targetplanet')) delete raw[key];
  }
}

function redactStrayPlayerNames(raw: Raw, own: number): void {
  for (const key of Object.keys(raw)) {
    if (!key.endsWith('playername')) continue;
    const idKey = `${key.slice(0, -'playername'.length)}playerid`;
    if (raw[idKey] !== String(own)) delete raw[key];
  }
}

// AGENTS.md §1.9: other players' ids and names never leave the machine (spec 2026-11-19 §3)
export function redactObservation<T extends Observation>(obs: T): T {
  if (obs.kind !== 'message') return obs;
  const own = obs.account.playerId;
  const raw: Raw = { ...obs.raw };
  switch (obs.messageType) {
    case COMBAT:
      redactFleets(raw, own);
      redactDefender(raw, own);
      break;
    case COMBAT_SHORT:
      delete raw.targetplanetid;
      delete raw.targetplanetname;
      break;
    case TRANSPORT:
      redactTransport(raw, own);
      break;
    case ANOMALY_REWARD:
      redactAnomalyReward(raw, own);
      break;
  }
  redactStrayPlayerNames(raw, own);
  return { ...obs, raw } as T;
}
