import type { Resources, ShipCounts } from './domain';
import type { ExpeditionResult, LifeformDiscoveryResult, ParsedEvent } from './events';
import { SHIP_COSTS } from './ships';

export type ValuationSettings = {
  msuRatio: [number, number, number];
  expeditionShipRatio: number;
  anomalyShipRatio: number;
  ignoreExpeShipsLoss: boolean;
  ignoreConsumption: boolean;
  includeTradesInBalance: boolean;
};

export const DEFAULT_VALUATION: ValuationSettings = {
  msuRatio: [3, 2, 1],
  expeditionShipRatio: 100,
  anomalyShipRatio: 100,
  ignoreExpeShipsLoss: false,
  ignoreConsumption: false,
  includeTradesInBalance: false,
};

export type StoredEvent = { day: string; status: 'ok' | 'conflict'; event: ParsedEvent };

export type BalanceCategory =
  | 'expeditions'
  | 'combats'
  | 'recycling'
  | 'wreckfields'
  | 'fuel'
  | 'anomalies';

export type DetailRowKey =
  | 'expeditions'
  | 'combats'
  | 'recycling'
  | 'wreckfields'
  | 'anomalies'
  | 'discoveries'
  | 'fuel'
  | 'trades'
  | 'total';

// null means not applicable (shown as "-"); unknown counts the row's unknown values.
export type DetailRow = {
  count: number | null;
  resources: Resources | null;
  msu: number | null;
  darkMatter: number | null;
  artefacts: number | null;
  lithium: number | null;
  unknown: number;
};

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
    artefacts: number;
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
  anomalies: {
    combats: { count: number; won: number; lost: number; draw: number; shipsLost: ShipCounts };
    rewards: {
      count: number;
      resources: Resources;
      ships: ShipCounts;
      artefacts: number;
      xpByLifeform: Record<string, number>;
      xpUnknown: number;
    };
    lithium: {
      spent: number;
      refunded: number;
      net: number;
      spentUnknown: number;
      refundUnknown: number;
      darkMatterUnknown: number;
      darkMatterSpent: number;
      scans: number;
      collects: number;
    };
  };
  recycling: { count: number; resources: Resources };
  discoveries: {
    count: number;
    outcomes: Record<LifeformDiscoveryResult, number>;
    xpByLifeform: Record<string, number>;
    artefacts: number;
  };
  wreckfields: { count: number; shipsRecovered: ShipCounts };
  trades: {
    received: Resources;
    delivered: Resources;
    receivedCount: number;
    deliveredCount: number;
  };
  conflictCount: number;
  rows: Record<DetailRowKey, DetailRow>;
  ships: { found: ShipCounts; lost: ShipCounts };
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

const addCounts = (into: Record<string, number>, counts: Record<string, number> | null): void => {
  if (!counts) return;
  for (const [key, n] of Object.entries(counts)) into[key] = (into[key] ?? 0) + n;
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

// + 0 normalises Math.ceil's -0
export const toMsu = (res: Resources, ratio: [number, number, number]): number =>
  Math.ceil(
    res.metal + (res.crystal * ratio[0]) / ratio[1] + (res.deuterium * ratio[0]) / ratio[2],
  ) + 0;

const netOf = ({ gains, losses }: Balance): Resources => {
  const net = zeroRes();
  addRes(net, gains);
  addRes(net, losses, -1);
  return net;
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
      anomalies: zeroBalance(),
    },
    fuel: { recorded: 0, departures: 0, unknownCount: 0 },
    expeditions: {
      count: 0,
      outcomes: zeroCounts(EXPEDITION_RESULTS),
      resources: zeroRes(),
      darkMatter: 0,
      artefacts: 0,
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
    anomalies: {
      combats: { count: 0, won: 0, lost: 0, draw: 0, shipsLost: {} },
      rewards: {
        count: 0,
        resources: zeroRes(),
        ships: {},
        artefacts: 0,
        xpByLifeform: {},
        xpUnknown: 0,
      },
      lithium: {
        spent: 0,
        refunded: 0,
        net: 0,
        spentUnknown: 0,
        refundUnknown: 0,
        darkMatterUnknown: 0,
        darkMatterSpent: 0,
        scans: 0,
        collects: 0,
      },
    },
    recycling: { count: 0, resources: zeroRes() },
    discoveries: {
      count: 0,
      outcomes: zeroCounts(DISCOVERY_RESULTS),
      xpByLifeform: {},
      artefacts: 0,
    },
    wreckfields: { count: 0, shipsRecovered: {} },
    trades: { received: zeroRes(), delivered: zeroRes(), receivedCount: 0, deliveredCount: 0 },
    conflictCount: 0,
    rows: {} as Record<DetailRowKey, DetailRow>,
    ships: { found: {}, lost: {} },
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
        stats.expeditions.artefacts += e.artifacts ?? 0;
        stats.tiles.artefacts += e.artifacts ?? 0;
        addCounts(stats.expeditions.shipsFound, e.shipsFound);
        addCounts(stats.expeditions.shipsLost, e.shipsLost);
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
        // docs/decisions.md scope 13: anomaly combats and their losses live in the anomalies category
        if (e.isAnomaly === true) {
          stats.anomalies.combats.count++;
          stats.anomalies.combats[e.outcome]++;
          addCounts(stats.anomalies.combats.shipsLost, e.shipsLost);
          loss(balance.anomalies, e.shipsLost, false);
          break;
        }
        stats.combats.count++;
        stats.combats[e.outcome]++;
        if (e.isProbeOnly) stats.combats.probeOnly++;
        addRes(stats.combats.lootSigned, e.loot, e.lootSign);
        addRes(stats.combats.debrisCreated, e.debrisCreated);
        addCounts(
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
        addCounts(
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
        addCounts(stats.wreckfields.shipsRecovered, e.shipsRecovered);
        addShipValue(balance.wreckfields.gains, e.shipsRecovered);
        break;
      case 'transport':
        if (e.direction === 'received') {
          stats.trades.receivedCount++;
          addRes(stats.trades.received, e.resources);
        } else if (e.direction === 'delivered') {
          stats.trades.deliveredCount++;
          addRes(stats.trades.delivered, e.resources);
        }
        break;
      case 'anomaly_reward':
        // User decision 2026-11-12 (docs/decisions.md): anomaly ships use anomalyShipRatio
        stats.anomalies.rewards.count++;
        addRes(stats.anomalies.rewards.resources, e.resources);
        addCounts(stats.anomalies.rewards.ships, e.ships);
        stats.anomalies.rewards.artefacts += e.artefacts ?? 0;
        stats.tiles.artefacts += e.artefacts ?? 0;
        if (e.xpByLifeform) addCounts(stats.anomalies.rewards.xpByLifeform, e.xpByLifeform);
        else stats.anomalies.rewards.xpUnknown++;
        addRes(balance.anomalies.gains, e.resources);
        addShipValue(balance.anomalies.gains, e.ships, settings.anomalyShipRatio);
        break;
      case 'anomaly_action': {
        // docs/decisions.md scope 13: lithium and the Dark Matter paid stay out of balance and tiles
        const l = stats.anomalies.lithium;
        if (e.action === 'scan') l.scans++;
        else l.collects++;
        if (e.lithium === null) l.spentUnknown++;
        else l.spent += e.lithium;
        if (e.lithiumBonus === null) l.refundUnknown++;
        else l.refunded += e.lithiumBonus;
        if (e.action === 'collect_dm') {
          if (e.darkMatter === null) l.darkMatterUnknown++;
          else l.darkMatterSpent += e.darkMatter;
        }
        l.net = l.refunded - l.spent;
        break;
      }
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
  if (settings.includeTradesInBalance) {
    addRes(net, stats.trades.received);
    addRes(net, stats.trades.delivered, -1);
  }
  Object.assign(stats.tiles, {
    metal: net.metal,
    crystal: net.crystal,
    deuterium: net.deuterium,
    msu: toMsu(net, settings.msuRatio),
  });
  fillDetail(stats, settings);
  return stats;
}

function fillDetail(stats: StatsSummary, settings: ValuationSettings): void {
  const { balance, tiles, anomalies, rows, ships } = stats;
  const { msuRatio } = settings;
  const empty: DetailRow = {
    count: null,
    resources: null,
    msu: null,
    darkMatter: null,
    artefacts: null,
    lithium: null,
    unknown: 0,
  };
  const withRes = (count: number, resources: Resources, extra: Partial<DetailRow> = {}) => ({
    ...empty,
    count,
    resources,
    msu: toMsu(resources, msuRatio),
    ...extra,
  });
  const lithiumUnknown = anomalies.lithium.spentUnknown + anomalies.lithium.refundUnknown;
  const fuelResources = settings.ignoreConsumption
    ? null
    : { metal: 0, crystal: 0, deuterium: 0 - stats.fuel.recorded };

  rows.expeditions = withRes(stats.expeditions.count, netOf(balance.expeditions), {
    darkMatter: stats.expeditions.darkMatter,
    // No live expedition message carries artifactsfound (2026-11-13): "-" unless one ever does
    artefacts: stats.expeditions.artefacts > 0 ? stats.expeditions.artefacts : null,
  });
  rows.combats = withRes(stats.combats.count, netOf(balance.combats));
  rows.recycling = withRes(stats.recycling.count, netOf(balance.recycling));
  rows.wreckfields = withRes(stats.wreckfields.count, netOf(balance.wreckfields));
  // Paid Dark Matter stays out of the AM column so the total keeps matching the tile.
  rows.anomalies = withRes(
    anomalies.combats.count + anomalies.rewards.count,
    netOf(balance.anomalies),
    {
      artefacts: anomalies.rewards.artefacts,
      lithium: anomalies.lithium.net,
      unknown: lithiumUnknown,
    },
  );
  rows.discoveries = {
    ...empty,
    count: stats.discoveries.count,
    artefacts: stats.discoveries.artefacts,
  };
  rows.fuel = {
    ...empty,
    count: stats.fuel.departures,
    resources: fuelResources,
    msu: fuelResources ? toMsu(fuelResources, msuRatio) : null,
    unknown: stats.fuel.unknownCount,
  };
  if (settings.includeTradesInBalance) {
    const trades = zeroRes();
    addRes(trades, stats.trades.received);
    addRes(trades, stats.trades.delivered, -1);
    rows.trades = withRes(stats.trades.receivedCount + stats.trades.deliveredCount, trades);
  } else {
    rows.trades = { ...empty };
  }

  const shown = Object.values(rows);
  rows.total = {
    count: shown.reduce((sum, r) => sum + (r.count ?? 0), 0),
    resources: { metal: tiles.metal, crystal: tiles.crystal, deuterium: tiles.deuterium },
    msu: tiles.msu,
    darkMatter: tiles.darkMatter,
    artefacts: tiles.artefacts,
    lithium: anomalies.lithium.net,
    unknown: shown.reduce((sum, r) => sum + r.unknown, 0),
  };

  addCounts(ships.found, stats.expeditions.shipsFound);
  addCounts(ships.found, anomalies.rewards.ships);
  addCounts(ships.found, stats.wreckfields.shipsRecovered);
  addCounts(ships.lost, stats.expeditions.shipsLost);
  addCounts(ships.lost, stats.combats.shipsLost);
  addCounts(ships.lost, stats.combats.expeditionShipsLost);
  addCounts(ships.lost, anomalies.combats.shipsLost);
}
