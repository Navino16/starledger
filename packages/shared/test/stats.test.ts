import { describe, expect, it } from 'vitest';
import type {
  AnomalyActionEvent,
  CombatEvent,
  ExpeditionEvent,
  FuelEvent,
  LifeformDiscoveryEvent,
  ParsedEvent,
  RecyclingEvent,
  ShortCombatEvent,
  TransportEvent,
  WreckfieldEvent,
} from '../src/events';
import {
  computeStats,
  DEFAULT_VALUATION,
  type StoredEvent,
  type ValuationSettings,
} from '../src/stats';

const coords = { galaxy: 1, system: 2, position: 16 };
const res = (metal = 0, crystal = 0, deuterium = 0) => ({ metal, crystal, deuterium });

const expedition = (o: Partial<ExpeditionEvent> = {}): ExpeditionEvent => ({
  kind: 'expedition',
  coords,
  result: 'resources',
  size: 0,
  depletion: null,
  resources: null,
  darkMatter: null,
  shipsFound: null,
  shipsLost: null,
  itemId: null,
  lifeform: null,
  lifeformXp: null,
  artifacts: null,
  ...o,
});
const discovery = (o: Partial<LifeformDiscoveryEvent> = {}): LifeformDiscoveryEvent => ({
  kind: 'lifeform_discovery',
  coords,
  result: 'none',
  lifeform: null,
  xp: null,
  artifacts: null,
  artifactsSize: null,
  ...o,
});
const combat = (o: Partial<CombatEvent> = {}): CombatEvent => ({
  kind: 'combat',
  coords,
  isExpedition: false,
  isProbeOnly: false,
  isAnomaly: false,
  ownSide: 'attacker',
  ownPlanetDefended: false,
  outcome: 'won',
  loot: res(),
  lootSign: 1,
  debrisCreated: res(),
  shipsLost: {},
  ...o,
});
const shortCombat = (o: Partial<ShortCombatEvent> = {}): ShortCombatEvent => ({
  kind: 'combat_short',
  coords,
  isExpedition: false,
  isProbeOnly: false,
  shipsLost: {},
  ...o,
});
const recycling = (o: Partial<RecyclingEvent> = {}): RecyclingEvent => ({
  kind: 'recycling',
  coords,
  isExpedition: false,
  resources: res(),
  ...o,
});
const transport = (direction: TransportEvent['direction'], resources = res()): TransportEvent => ({
  kind: 'transport',
  direction,
  resources,
});
const wreck = (o: Partial<WreckfieldEvent> = {}): WreckfieldEvent => ({
  kind: 'wreckfield',
  coords,
  shipsRecovered: {},
  ...o,
});
const fuel = (consumption: number | null): FuelEvent => ({
  kind: 'fuel',
  source: 'fleetdispatch',
  mission: 15,
  origin: null,
  target: { ...coords, type: 1 },
  ships: {},
  consumption,
});

const stored = (event: ParsedEvent, status: 'ok' | 'conflict' = 'ok'): StoredEvent => ({
  day: '2026-11-11',
  status,
  event,
});
const run = (events: ParsedEvent[], s: Partial<ValuationSettings> = {}) =>
  computeStats(
    events.map((e) => stored(e)),
    { ...DEFAULT_VALUATION, ...s },
  );

describe('computeStats', () => {
  it('exposes the default valuation', () => {
    expect(DEFAULT_VALUATION).toEqual({
      msuRatio: [3, 2, 1],
      expeditionShipRatio: 100,
      anomalyShipRatio: 100,
      ignoreExpeShipsLoss: false,
      ignoreConsumption: false,
      includeTradesInBalance: false,
    });
  });

  it('returns zeros for an empty list', () => {
    const s = computeStats([], DEFAULT_VALUATION);
    expect(s.tiles).toEqual({
      metal: 0,
      crystal: 0,
      deuterium: 0,
      darkMatter: 0,
      artefacts: 0,
      msu: 0,
    });
    expect(s.fuel).toEqual({ recorded: 0, departures: 0, unknownCount: 0 });
    expect(s.conflictCount).toBe(0);
    expect(s.expeditions.count).toBe(0);
    expect(s.expeditions.outcomes.aliens).toBe(0);
    expect(s.discoveries.outcomes.lifeform_found).toBe(0);
    expect(s.combats).toMatchObject({ count: 0, won: 0, lost: 0, draw: 0, probeOnly: 0 });
  });

  it('counts an expedition of 1000 metal', () => {
    const s = run([expedition({ resources: res(1000) })]);
    expect(s.tiles.metal).toBe(1000);
    expect(s.tiles.msu).toBe(1000);
    expect(s.expeditions.resources.metal).toBe(1000);
    expect(s.expeditions.outcomes.resources).toBe(1);
  });

  it('counts two distinct identical expeditions each', () => {
    const e = expedition({ resources: res(1000) });
    expect(run([e, { ...e }]).tiles.metal).toBe(2000);
  });

  it('adds found ships at the expedition ship ratio', () => {
    const s = run([expedition({ result: 'ships', shipsFound: { '202': 3 } })], {
      expeditionShipRatio: 50,
    });
    expect(s.tiles.metal).toBe(3000);
    expect(s.tiles.crystal).toBe(3000);
    expect(s.expeditions.shipsFound).toEqual({ '202': 3 });
  });

  it('keeps fractional ship ratio values and only ceils MSU', () => {
    const s = run([expedition({ shipsFound: { '202': 1 } })], { expeditionShipRatio: 33 });
    expect(s.tiles.metal).toBeCloseTo(660);
    expect(Number.isInteger(s.tiles.msu)).toBe(true);
  });

  it('deducts probe losses of a probe-only combat', () => {
    const s = run([combat({ isProbeOnly: true, shipsLost: { '210': 2 } })]);
    expect(s.tiles.crystal).toBe(-2000);
    expect(s.combats.probeOnly).toBe(1);
  });

  it('deducts probe-only short combat losses and counts them', () => {
    const s = run([shortCombat({ isProbeOnly: true, shipsLost: { '210': 2 } })]);
    expect(s.tiles.crystal).toBe(-2000);
    expect(s.combats.count).toBe(1);
    expect(s.combats.probeOnly).toBe(1);
    expect(s.combats.shipsLost).toEqual({ '210': 2 });
    expect(s.combats.won + s.combats.lost + s.combats.draw).toBe(0);
  });

  it('subtracts loot of a lost defence', () => {
    const s = run([combat({ outcome: 'lost', ownSide: 'defender', loot: res(500), lootSign: -1 })]);
    expect(s.tiles.metal).toBe(-500);
    expect(s.combats.lost).toBe(1);
    expect(s.combats.lootSigned.metal).toBe(-500);
  });

  it('attaches an anomaly combat to the anomalies category only', () => {
    const s = run([
      combat({
        isAnomaly: true,
        ownSide: 'defender',
        outcome: 'draw',
        lootSign: 0,
        debrisCreated: res(4800, 1600),
        shipsLost: { '204': 4 },
      }),
    ]);
    expect(s.anomalies.combats).toEqual({
      count: 1,
      won: 0,
      lost: 0,
      draw: 1,
      shipsLost: { '204': 4 },
    });
    expect(s.balance.anomalies.losses).toEqual(res(12000, 4000));
    expect(s.balance.combats).toEqual({ gains: res(), losses: res() });
    expect(s.combats).toMatchObject({ count: 0, draw: 0, shipsLost: {} });
    expect(s.combats.debrisCreated).toEqual(res());
    expect(s.tiles.metal).toBe(-12000);
    expect(s.tiles.crystal).toBe(-4000);
  });

  it('counts anomaly rewards and values resources and ships at 100 percent', () => {
    const s = run(
      [
        {
          kind: 'anomaly_reward',
          anomalyCoords: null,
          resources: res(1000, 500, 100),
          ships: { '202': 2 },
        },
        { kind: 'anomaly_reward', anomalyCoords: null, resources: res(10), ships: { '202': 1 } },
      ],
      { expeditionShipRatio: 50 },
    );
    expect(s.anomalies.rewards).toEqual({
      count: 2,
      resources: res(1010, 500, 100),
      ships: { '202': 3 },
    });
    expect(s.balance.anomalies.gains).toEqual(res(7010, 6500, 100));
    expect(s.tiles.metal).toBe(7010);
    expect(s.tiles.crystal).toBe(6500);
    expect(s.tiles.deuterium).toBe(100);
  });

  it('values anomaly reward ships at the anomaly ship ratio, independently of the expedition one', () => {
    const anomaly: ParsedEvent = {
      kind: 'anomaly_reward',
      anomalyCoords: null,
      resources: res(1000),
      ships: { '202': 2 },
    };
    const half = run([anomaly], { anomalyShipRatio: 50, expeditionShipRatio: 100 });
    expect(half.balance.anomalies.gains).toEqual(res(3000, 2000));
    expect(half.tiles.metal).toBe(3000);
    expect(half.tiles.crystal).toBe(2000);
    const other = run([anomaly], { anomalyShipRatio: 100, expeditionShipRatio: 0 });
    expect(other.balance.anomalies.gains).toEqual(res(5000, 4000));
    const exp = run([expedition({ shipsFound: { '202': 1 } })], { anomalyShipRatio: 0 });
    expect(exp.tiles.metal).toBe(2000);
  });

  it('totals lithium spent, refunded and unknown over anomaly actions without touching tiles', () => {
    const act = (o: Partial<AnomalyActionEvent>): AnomalyActionEvent => ({
      kind: 'anomaly_action',
      action: 'scan',
      lithium: 0,
      darkMatter: null,
      lithiumBonus: 0,
      ...o,
    });
    const s = run([
      act({ lithium: 1000 }),
      act({ action: 'collect', lithium: 500, lithiumBonus: 120 }),
      act({ action: 'collect', lithium: null, lithiumBonus: null }),
      act({ action: 'collect_dm', lithium: 300, darkMatter: 590 }),
      act({ action: 'collect_dm', lithium: 200, darkMatter: null }),
    ]);
    expect(s.anomalies.lithium).toEqual({
      spent: 2000,
      refunded: 120,
      net: -1880,
      spentUnknown: 1,
      refundUnknown: 1,
      darkMatterUnknown: 1,
      darkMatterSpent: 590,
      scans: 1,
      collects: 4,
    });
    expect(s.balance.anomalies).toEqual({ gains: res(), losses: res() });
    expect(s.tiles).toEqual(run([]).tiles);
  });

  it('counts a stored combat without isAnomaly as a normal combat', () => {
    const { isAnomaly: _omitted, ...stored } = combat({ shipsLost: { '204': 1 } });
    const s = run([stored as CombatEvent]);
    expect(s.combats.count).toBe(1);
    expect(s.anomalies.combats.count).toBe(0);
    expect(s.balance.anomalies.losses).toEqual(res());
  });

  it('never counts created debris in tiles', () => {
    const s = run([combat({ debrisCreated: res(10000) })]);
    expect(s.tiles.metal).toBe(0);
    expect(s.combats.debrisCreated.metal).toBe(10000);
  });

  it('subtracts fuel from deuterium unless ignored', () => {
    expect(run([fuel(300)]).tiles.deuterium).toBe(-300);
    const ignored = run([fuel(300)], { ignoreConsumption: true });
    expect(ignored.tiles.deuterium).toBe(0);
    expect(ignored.fuel.recorded).toBe(300);
  });

  it('counts unknown fuel without inventing a value', () => {
    const s = run([fuel(null)]);
    expect(s.fuel).toEqual({ recorded: 0, departures: 1, unknownCount: 1 });
    expect(s.tiles.deuterium).toBe(0);
  });

  it('computes MSU with the configured ratio', () => {
    const s = run([expedition({ resources: res(0, 200, 100) })]);
    expect(s.tiles.msu).toBe(600);
  });

  it('uses net tiles for MSU', () => {
    const s = run([expedition({ resources: res(1000) }), fuel(0)]);
    expect(s.tiles.msu).toBe(1000);
    const l = run([combat({ shipsLost: { '202': 1 } })]);
    expect(l.tiles.msu).toBe(Math.ceil(-2000 + (-2000 * 3) / 2));
  });

  it('ignores expedition-related ship losses when asked', () => {
    const events = [
      expedition({ shipsLost: { '202': 1 } }),
      combat({ isExpedition: true, shipsLost: { '202': 1 } }),
      combat({ shipsLost: { '202': 1 } }),
    ];
    expect(run(events).tiles.metal).toBe(-6000);
    expect(run(events, { ignoreExpeShipsLoss: true }).tiles.metal).toBe(-2000);
  });

  it('counts full and short combats together, outcomes from full combats only', () => {
    const s = run([
      combat({ outcome: 'won' }),
      combat({ outcome: 'draw' }),
      shortCombat({ shipsLost: { '202': 1 } }),
    ]);
    expect(s.combats).toMatchObject({ count: 3, won: 1, lost: 0, draw: 1 });
    expect(s.combats.shipsLost).toEqual({ '202': 1 });
  });

  it('computes MSU without float noise from fractional ship ratios', () => {
    const s = run([expedition({ shipsFound: { '202': 1 } })], { expeditionShipRatio: 35 });
    expect(s.tiles.metal).toBe(700);
    expect(s.tiles.crystal).toBe(700);
    expect(s.tiles.msu).toBe(1750);
  });

  it('never returns -0 for MSU', () => {
    expect(Object.is(run([]).tiles.msu, 0)).toBe(true);
  });

  it('splits expedition and regular combat ship losses', () => {
    const s = run([
      combat({ isExpedition: true, shipsLost: { '202': 1 } }),
      shortCombat({ isExpedition: true, shipsLost: { '202': 2 } }),
      combat({ shipsLost: { '210': 1 } }),
    ]);
    expect(s.combats.expeditionShipsLost).toEqual({ '202': 3 });
    expect(s.combats.shipsLost).toEqual({ '210': 1 });
  });

  it('fills the per-category balance with positive gains and losses', () => {
    const s = run([
      expedition({ resources: res(100), shipsFound: { '202': 1 }, shipsLost: { '210': 1 } }),
      combat({ loot: res(500, 20), lootSign: 1, shipsLost: { '202': 1 } }),
      combat({ loot: res(70), lootSign: -1 }),
      recycling({ resources: res(10, 5) }),
      wreck({ shipsRecovered: { '202': 1 } }),
      fuel(300),
    ]);
    expect(s.balance.expeditions).toEqual({ gains: res(2100, 2000), losses: res(0, 1000) });
    expect(s.balance.combats).toEqual({ gains: res(500, 20), losses: res(2070, 2000) });
    expect(s.balance.recycling).toEqual({ gains: res(10, 5), losses: res() });
    expect(s.balance.wreckfields.gains).toEqual(res(2000, 2000));
    expect(s.balance.fuel).toEqual({ gains: res(), losses: res(0, 0, 300) });
  });

  it.each([
    {},
    { ignoreExpeShipsLoss: true },
    { ignoreConsumption: true },
    { ignoreExpeShipsLoss: true, ignoreConsumption: true },
  ])('balance nets exactly to the tiles with %j', (flags) => {
    const s = run(
      [
        expedition({
          resources: res(1000, 10, 5),
          shipsFound: { '202': 2 },
          shipsLost: { '202': 1 },
        }),
        discovery({ result: 'ship_lost' }),
        combat({ isExpedition: true, loot: res(300), shipsLost: { '202': 1 } }),
        combat({ loot: res(40, 30, 20), lootSign: -1, shipsLost: { '210': 3 } }),
        shortCombat({ isExpedition: true, shipsLost: { '202': 1 } }),
        shortCombat({ shipsLost: { '210': 1 } }),
        recycling({ resources: res(100, 50, 25) }),
        wreck({ shipsRecovered: { '202': 2 } }),
        fuel(300),
        fuel(null),
      ],
      { expeditionShipRatio: 50, ...flags },
    );
    const net = res();
    for (const { gains, losses } of Object.values(s.balance)) {
      for (const k of ['metal', 'crystal', 'deuterium'] as const) {
        expect(gains[k]).toBeGreaterThanOrEqual(0);
        expect(losses[k]).toBeGreaterThanOrEqual(0);
        net[k] += gains[k] - losses[k];
      }
    }
    expect(net).toEqual({
      metal: s.tiles.metal,
      crystal: s.tiles.crystal,
      deuterium: s.tiles.deuterium,
    });
  });

  it('adds recycling and wreckfield recoveries', () => {
    const s = run([
      recycling({ resources: res(100, 50) }),
      wreck({ shipsRecovered: { '202': 2 } }),
    ]);
    expect(s.tiles.metal).toBe(4100);
    expect(s.tiles.crystal).toBe(4050);
    expect(s.recycling).toEqual({ count: 1, resources: res(100, 50) });
    expect(s.wreckfields).toEqual({ count: 1, shipsRecovered: { '202': 2 } });
  });

  it('adds dark matter and artefacts from expeditions and discoveries', () => {
    const s = run([
      expedition({ result: 'darkmatter', darkMatter: 500, artifacts: 2 }),
      discovery({ result: 'artifacts', artifacts: 3 }),
    ]);
    expect(s.tiles.darkMatter).toBe(500);
    expect(s.expeditions.darkMatter).toBe(500);
    expect(s.tiles.artefacts).toBe(5);
    expect(s.discoveries.artefacts).toBe(3);
  });

  it('aggregates discovery XP per lifeform and skips nulls', () => {
    const s = run([
      discovery({ result: 'lifeform_xp', lifeform: 2, xp: 100 }),
      discovery({ result: 'lifeform_xp', lifeform: 2, xp: 50 }),
      discovery({ result: 'lifeform_xp', lifeform: null, xp: 10 }),
      discovery({ result: 'lifeform_xp', lifeform: 3, xp: null }),
    ]);
    expect(s.discoveries.xpByLifeform).toEqual({ '2': 150 });
    expect(s.discoveries.count).toBe(4);
    expect(s.discoveries.outcomes.lifeform_xp).toBe(4);
  });

  it('keeps unknown ship ids in aggregates but adds nothing to tiles', () => {
    const s = run([expedition({ shipsFound: { '999': 4 } })]);
    expect(s.expeditions.shipsFound).toEqual({ '999': 4 });
    expect(s.tiles.metal).toBe(0);
  });

  it('treats null fields as unknown contributions', () => {
    const s = run([expedition()]);
    expect(s.expeditions.count).toBe(1);
    expect(s.tiles).toMatchObject({ metal: 0, darkMatter: 0, artefacts: 0 });
  });

  it('counts conflict events with their stored state', () => {
    const s = computeStats(
      [stored(expedition({ resources: res(1000) }), 'conflict'), stored(expedition())],
      DEFAULT_VALUATION,
    );
    expect(s.conflictCount).toBe(1);
    expect(s.tiles.metal).toBe(1000);
    expect(s.expeditions.count).toBe(2);
  });

  it('does not mutate its input', () => {
    const events = [
      stored(expedition({ resources: res(1000), shipsFound: { '202': 1 } })),
      stored(combat({ shipsLost: { '202': 1 } })),
      stored(wreck({ shipsRecovered: { '202': 1 } })),
    ];
    const snapshot = structuredClone(events);
    const settings = structuredClone(DEFAULT_VALUATION);
    const deepFreeze = (o: unknown): void => {
      if (o && typeof o === 'object') {
        Object.freeze(o);
        for (const v of Object.values(o)) deepFreeze(v);
      }
    };
    deepFreeze(events);
    deepFreeze(settings);
    computeStats(events, settings);
    expect(events).toEqual(snapshot);
  });

  describe('trades', () => {
    const trades = [
      transport('received', res(100, 50, 20)),
      transport('received', res(10, 0, 0)),
      transport('delivered', res(30, 20, 10)),
      transport('internal', res(999, 999, 999)),
    ];

    it('sums received and delivered with their counts, ignoring internal', () => {
      expect(run(trades).trades).toEqual({
        received: res(110, 50, 20),
        delivered: res(30, 20, 10),
        receivedCount: 2,
        deliveredCount: 1,
      });
    });

    it('starts at zero', () => {
      expect(run([]).trades).toEqual({
        received: res(),
        delivered: res(),
        receivedCount: 0,
        deliveredCount: 0,
      });
    });

    it('leaves the tiles and balance unchanged by default', () => {
      const s = run([expedition({ resources: res(1000) }), ...trades]);
      expect(s.tiles).toMatchObject({ metal: 1000, crystal: 0, deuterium: 0, msu: 1000 });
      expect(s.balance).toEqual(run([expedition({ resources: res(1000) })]).balance);
    });

    it('adds received minus delivered to the tiles when included', () => {
      const s = run([expedition({ resources: res(1000) }), ...trades], {
        includeTradesInBalance: true,
      });
      expect(s.tiles).toMatchObject({
        metal: 1080,
        crystal: 30,
        deuterium: 10,
        msu: Math.ceil(1080 + (30 * 3) / 2 + (10 * 3) / 1),
      });
      expect(s.balance).toEqual(run([expedition({ resources: res(1000) })]).balance);
    });
  });
});
