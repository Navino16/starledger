import type { Resources, ShipCounts } from './domain';
import type { ExpeditionResult, LifeformDiscoveryResult, ParsedEvent } from './events';
import { SHIP_COSTS } from './ships';

export type ValuationSettings = {
  msuRatio: [number, number, number];
  expeditionShipRatio: number;
  ignoreExpeShipsLoss: boolean;
  ignoreConsumption: boolean;
  includeTradesInBalance: boolean;
};

export const DEFAULT_VALUATION: ValuationSettings = {
  msuRatio: [3, 2, 1],
  expeditionShipRatio: 100,
  ignoreExpeShipsLoss: false,
  ignoreConsumption: false,
  includeTradesInBalance: false,
};

export type StoredEvent = { day: string; status: 'ok' | 'conflict'; event: ParsedEvent };

export type BalanceCategory = 'expeditions' | 'combats' | 'recycling' | 'wreckfields' | 'fuel';

export type Balance = { gains: Resources; losses: Resources };

export type StatsSummary = {
  tiles: {
    metal: number;
    crystal: number;
    deuterium: number;
    darkMatter: number;
    artefacts: number;
    msu: number;
  };
  balance: Record<BalanceCategory, Balance>;
  fuel: { recorded: number; departures: number; unknownCount: number };
  expeditions: {
    count: number;
    outcomes: Record<ExpeditionResult, number>;
    resources: Resources;
    darkMatter: number;
    shipsFound: ShipCounts;
    shipsLost: ShipCounts;
  };
  combats: {
    count: number;
    won: number;
    lost: number;
    draw: number;
    lootSigned: Resources;
    shipsLost: ShipCounts;
    expeditionShipsLost: ShipCounts;
    debrisCreated: Resources;
    probeOnly: number;
  };
  recycling: { count: number; resources: Resources };
  discoveries: {
    count: number;
    outcomes: Record<LifeformDiscoveryResult, number>;
    xpByLifeform: Record<string, number>;
    artefacts: number;
  };
  wreckfields: { count: number; shipsRecovered: ShipCounts };
  conflictCount: number;
};

const EXPEDITION_RESULT_KEYS = {
  resources: 0,
  darkmatter: 0,
  nothing: 0,
  ships: 0,
  trader: 0,
  item: 0,
  blackhole: 0,
  early: 0,
  late: 0,
  pirates: 0,
  aliens: 0,
} satisfies Record<ExpeditionResult, 0>;
const DISCOVERY_RESULT_KEYS = {
  none: 0,
  artifacts: 0,
  lifeform_xp: 0,
  ship_lost: 0,
  lifeform_found: 0,
} satisfies Record<LifeformDiscoveryResult, 0>;
const EXPEDITION_RESULTS = Object.keys(EXPEDITION_RESULT_KEYS) as ExpeditionResult[];
const DISCOVERY_RESULTS = Object.keys(DISCOVERY_RESULT_KEYS) as LifeformDiscoveryResult[];

const zeroRes = (): Resources => ({ metal: 0, crystal: 0, deuterium: 0 });
const zeroCounts = <K extends string>(keys: K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

const addRes = (into: Resources, r: Resources, factor = 1): void => {
  into.metal += r.metal * factor;
  into.crystal += r.crystal * factor;
  into.deuterium += r.deuterium * factor;
};

const addShips = (into: ShipCounts, ships: ShipCounts | null): void => {
  if (!ships) return;
  for (const [id, n] of Object.entries(ships)) into[id] = (into[id] ?? 0) + n;
};

// Multiply before dividing to avoid float noise; ship ids absent from SHIP_COSTS add nothing.
const addShipValue = (into: Resources, ships: ShipCounts | null, percent = 100): void => {
  if (!ships) return;
  for (const [id, n] of Object.entries(ships)) {
    const cost = SHIP_COSTS[id];
    if (!cost) continue;
    into.metal += (cost.metal * n * percent) / 100;
    into.crystal += (cost.crystal * n * percent) / 100;
    into.deuterium += (cost.deuterium * n * percent) / 100;
  }
};

const zeroBalance = (): Balance => ({ gains: zeroRes(), losses: zeroRes() });

// design §5.6: tile rules; unknown (null) values contribute nothing.
export function computeStats(events: StoredEvent[], settings: ValuationSettings): StatsSummary {
  const stats: StatsSummary = {
    tiles: { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, artefacts: 0, msu: 0 },
    balance: {
      expeditions: zeroBalance(),
      combats: zeroBalance(),
      recycling: zeroBalance(),
      wreckfields: zeroBalance(),
      fuel: zeroBalance(),
    },
    fuel: { recorded: 0, departures: 0, unknownCount: 0 },
    expeditions: {
      count: 0,
      outcomes: zeroCounts(EXPEDITION_RESULTS),
      resources: zeroRes(),
      darkMatter: 0,
      shipsFound: {},
      shipsLost: {},
    },
    combats: {
      count: 0,
      won: 0,
      lost: 0,
      draw: 0,
      lootSigned: zeroRes(),
      shipsLost: {},
      expeditionShipsLost: {},
      debrisCreated: zeroRes(),
      probeOnly: 0,
    },
    recycling: { count: 0, resources: zeroRes() },
    discoveries: {
      count: 0,
      outcomes: zeroCounts(DISCOVERY_RESULTS),
      xpByLifeform: {},
      artefacts: 0,
    },
    wreckfields: { count: 0, shipsRecovered: {} },
    conflictCount: 0,
  };
  const { balance } = stats;

  const loss = (into: Balance, ships: ShipCounts | null, isExpeditionLoss: boolean): void => {
    if (isExpeditionLoss && settings.ignoreExpeShipsLoss) return;
    addShipValue(into.losses, ships);
  };

  for (const { status, event: e } of events) {
    if (status === 'conflict') stats.conflictCount++;
    switch (e.kind) {
      case 'expedition': {
        stats.expeditions.count++;
        stats.expeditions.outcomes[e.result]++;
        if (e.resources) {
          addRes(stats.expeditions.resources, e.resources);
          addRes(balance.expeditions.gains, e.resources);
        }
        stats.expeditions.darkMatter += e.darkMatter ?? 0;
        stats.tiles.darkMatter += e.darkMatter ?? 0;
        stats.tiles.artefacts += e.artifacts ?? 0;
        addShips(stats.expeditions.shipsFound, e.shipsFound);
        addShips(stats.expeditions.shipsLost, e.shipsLost);
        addShipValue(balance.expeditions.gains, e.shipsFound, settings.expeditionShipRatio);
        loss(balance.expeditions, e.shipsLost, true);
        break;
      }
      case 'lifeform_discovery': {
        stats.discoveries.count++;
        stats.discoveries.outcomes[e.result]++;
        stats.discoveries.artefacts += e.artifacts ?? 0;
        stats.tiles.artefacts += e.artifacts ?? 0;
        if (e.lifeform !== null && e.xp !== null) {
          const key = String(e.lifeform);
          stats.discoveries.xpByLifeform[key] = (stats.discoveries.xpByLifeform[key] ?? 0) + e.xp;
        }
        break;
      }
      case 'combat': {
        stats.combats.count++;
        stats.combats[e.outcome]++;
        if (e.isProbeOnly) stats.combats.probeOnly++;
        addRes(stats.combats.lootSigned, e.loot, e.lootSign);
        addRes(stats.combats.debrisCreated, e.debrisCreated);
        addShips(
          e.isExpedition ? stats.combats.expeditionShipsLost : stats.combats.shipsLost,
          e.shipsLost,
        );
        addRes(balance.combats.gains, e.loot, Math.max(e.lootSign, 0));
        addRes(balance.combats.losses, e.loot, Math.max(-e.lootSign, 0));
        loss(balance.combats, e.shipsLost, e.isExpedition);
        break;
      }
      case 'combat_short': {
        stats.combats.count++;
        if (e.isProbeOnly) stats.combats.probeOnly++;
        addShips(
          e.isExpedition ? stats.combats.expeditionShipsLost : stats.combats.shipsLost,
          e.shipsLost,
        );
        loss(balance.combats, e.shipsLost, e.isExpedition);
        break;
      }
      case 'recycling':
        stats.recycling.count++;
        addRes(stats.recycling.resources, e.resources);
        addRes(balance.recycling.gains, e.resources);
        break;
      case 'wreckfield':
        stats.wreckfields.count++;
        addShips(stats.wreckfields.shipsRecovered, e.shipsRecovered);
        addShipValue(balance.wreckfields.gains, e.shipsRecovered);
        break;
      case 'fuel':
        stats.fuel.departures++;
        if (e.consumption === null) stats.fuel.unknownCount++;
        else stats.fuel.recorded += e.consumption;
        break;
    }
  }

  if (!settings.ignoreConsumption) balance.fuel.losses.deuterium = stats.fuel.recorded;

  const net = zeroRes();
  for (const { gains, losses } of Object.values(balance)) {
    addRes(net, gains);
    addRes(net, losses, -1);
  }
  const [r0, r1, r2] = settings.msuRatio;
  Object.assign(stats.tiles, {
    metal: net.metal,
    crystal: net.crystal,
    deuterium: net.deuterium,
    // + 0 normalises Math.ceil's -0
    msu: Math.ceil(net.metal + (net.crystal * r0) / r1 + (net.deuterium * r0) / r2) + 0,
  });
  return stats;
}
