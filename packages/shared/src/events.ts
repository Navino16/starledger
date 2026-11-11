import type { Coords, Resources, ShipCounts } from './domain';

export type ExpeditionResult =
  | 'resources'
  | 'darkmatter'
  | 'nothing'
  | 'ships'
  | 'trader'
  | 'item'
  | 'blackhole'
  | 'early'
  | 'late'
  | 'pirates'
  | 'aliens';

// Known raw values only; the game may send others (docs/ogame-data-formats.md §3.1)
export const EXPEDITION_SIZES = { 0: 'large', 1: 'medium', 2: 'small' } as const;

export type ExpeditionEvent = {
  kind: 'expedition';
  coords: Coords;
  result: ExpeditionResult;
  size: number | null;
  depletion: number | null;
  resources: Resources | null;
  darkMatter: number | null;
  shipsFound: ShipCounts | null;
  shipsLost: ShipCounts | null;
  itemId: string | null;
  lifeform: number | null;
  lifeformXp: number | null;
  artifacts: number | null;
};

export type LifeformDiscoveryResult =
  | 'none'
  | 'artifacts'
  | 'lifeform_xp'
  | 'ship_lost'
  | 'lifeform_found';

// Known raw values only (docs/ogame-data-formats.md §3.2)
export const ARTIFACT_SIZES = ['normal', 'big', 'huge', 'full'] as const;

export type LifeformDiscoveryEvent = {
  kind: 'lifeform_discovery';
  coords: Coords;
  result: LifeformDiscoveryResult;
  lifeform: number | null;
  xp: number | null;
  artifacts: number | null;
  artifactsSize: string | null;
  shipsLost: ShipCounts | null;
};

export type CombatOutcome = 'won' | 'lost' | 'draw';

export type CombatEvent = {
  kind: 'combat';
  coords: Coords;
  isExpedition: boolean;
  isProbeOnly: boolean;
  ownSide: 'attacker' | 'defender';
  ownPlanetDefended: boolean;
  outcome: CombatOutcome;
  loot: Resources;
  lootSign: 1 | -1 | 0;
  debrisCreated: Resources;
  shipsLost: ShipCounts;
};

export type ShortCombatEvent = {
  kind: 'combat_short';
  coords: Coords;
  isExpedition: boolean;
  isProbeOnly: boolean;
  shipsLost: ShipCounts;
};

export type RecyclingEvent = {
  kind: 'recycling';
  coords: Coords;
  isExpedition: boolean;
  resources: Resources;
};

export type WreckfieldEvent = {
  kind: 'wreckfield';
  coords: Coords;
  shipsRecovered: ShipCounts;
};

export type FuelEvent = {
  kind: 'fuel';
  source: 'fleetdispatch' | 'minifleet';
  mission: number;
  origin: Coords | null;
  target: Coords & { type: 1 | 2 | 3 };
  ships: ShipCounts;
  consumption: number | null;
};

export type ParsedEvent =
  | ExpeditionEvent
  | LifeformDiscoveryEvent
  | CombatEvent
  | ShortCombatEvent
  | RecyclingEvent
  | WreckfieldEvent
  | FuelEvent;

export type ParseResult =
  | { status: 'ok'; externalKey: string; occurredAt: number; event: ParsedEvent }
  | { status: 'unrecognized'; externalKey: string; occurredAt: number | null; reason: string };
