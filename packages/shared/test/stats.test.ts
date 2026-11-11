import { describe, expect, it } from 'vitest';
import type {
  CombatEvent,
  ExpeditionEvent,
  FuelEvent,
  LifeformDiscoveryEvent,
  ParsedEvent,
  RecyclingEvent,
  ShortCombatEvent,
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
  shipsLost: null,
  ...o,
});
const combat = (o: Partial<CombatEvent> = {}): CombatEvent => ({
  kind: 'combat',
  coords,
  isExpedition: false,
  isProbeOnly: false,
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

  it('never counts created debris in tiles', () => {
    const s = run([combat({ debrisCreated: res(10000) })]);
    expect(s.tiles.metal).toBe(0);
    expect(s.combats.debrisCreated.metal).toBe(10000);
  });

  it('ignores debris and loot of short combats', () => {
    const s = run([shortCombat({ shipsLost: { '202': 1 } })]);
    expect(s.combats.lootSigned).toEqual(res());
    expect(s.combats.debrisCreated).toEqual(res());
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
      discovery({ shipsLost: { '202': 1 } }),
      combat({ isExpedition: true, shipsLost: { '202': 1 } }),
      combat({ shipsLost: { '202': 1 } }),
    ];
    expect(run(events).tiles.metal).toBe(-8000);
    expect(run(events, { ignoreExpeShipsLoss: true }).tiles.metal).toBe(-2000);
  });

  it('counts expedition combats (25) and 48 together, outcomes from 25 only', () => {
    const s = run([
      combat({ outcome: 'won' }),
      combat({ outcome: 'draw' }),
      shortCombat({ shipsLost: { '202': 1 } }),
    ]);
    expect(s.combats).toMatchObject({ count: 3, won: 1, lost: 0, draw: 1 });
    expect(s.combats.shipsLost).toEqual({ '202': 1 });
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
});
