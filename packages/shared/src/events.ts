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

export type ExpeditionSize = 'small' | 'medium' | 'large';

export type ExpeditionEvent = {
  kind: 'expedition';
  coords: Coords;
  result: ExpeditionResult;
  size: ExpeditionSize | null;
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

export type ArtifactsSize = 'normal' | 'big' | 'huge' | 'full';

export type LifeformDiscoveryEvent = {
  kind: 'lifeform_discovery';
  coords: Coords;
  result: LifeformDiscoveryResult;
  lifeform: number | null;
  xp: number | null;
  artifacts: number | null;
  artifactsSize: ArtifactsSize | null;
  shipsLost: ShipCounts | null;
};

export type ParsedEvent = ExpeditionEvent | LifeformDiscoveryEvent;

export type ParseResult =
  | { status: 'ok'; externalKey: string; occurredAt: number; event: ParsedEvent }
  | { status: 'unrecognized'; externalKey: string; occurredAt: number | null; reason: string };
