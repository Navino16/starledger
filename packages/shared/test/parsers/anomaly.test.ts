import { describe, expect, it } from 'vitest';
import { parseAnomalyReward } from '../../src/parsers/anomaly';
import { loadFixtures, observationOf, withRaw } from './helpers';

const base = observationOf(loadFixtures(''), 'recycling.json');
const obs = (loot: unknown, coords: string | null = '3:44:7', xp?: unknown) =>
  withRaw(base, {
    messagetype: '76',
    'x-loot': typeof loot === 'string' ? loot : JSON.stringify(loot),
    'x-anomalycoords': coords ?? undefined,
    'x-xp': xp === undefined ? undefined : typeof xp === 'string' ? xp : JSON.stringify(xp),
  });
const xp = (lifeform: number | null, amount: number | null) => ({ lifeform, amount });
const res = (resource: string, amount: number | null) => ({ type: 'resource', resource, amount });
const ship = (attributes: string[], amount: number | null) => ({
  type: 'ship',
  attributes,
  amount,
});

const eventOf = (r: ReturnType<typeof parseAnomalyReward>) => (r.status === 'ok' ? r.event : null);
const reasonOf = (r: ReturnType<typeof parseAnomalyReward>) =>
  r.status === 'unrecognized' ? r.reason : null;

describe('parseAnomalyReward', () => {
  it('reads resources only', () => {
    const r = parseAnomalyReward(obs([res('metal', 1000), res('deuterium', 50)]));
    expect(eventOf(r)).toEqual({
      kind: 'anomaly_reward',
      anomalyCoords: { galaxy: 3, system: 44, position: 7 },
      resources: { metal: 1000, crystal: 0, deuterium: 50 },
      ships: {},
      artefacts: 0,
      xpByLifeform: null,
    });
  });

  it('reads artefacts and sums the experience per lifeform', () => {
    const r = parseAnomalyReward(
      obs([res('metal', 550), res('artifact', 117), res('artifact', 3)], '3:44:7', [
        xp(1, 4444),
        xp(3, 1250),
        xp(1, 6),
      ]),
    );
    expect(eventOf(r)).toMatchObject({
      resources: { metal: 550, crystal: 0, deuterium: 0 },
      artefacts: 120,
      xpByLifeform: { '1': 4450, '3': 1250 },
    });
  });

  it('knows a reward without experience from an older collector', () => {
    expect(eventOf(parseAnomalyReward(obs([res('metal', 1)], '3:44:7', [])))).toMatchObject({
      xpByLifeform: {},
    });
    expect(eventOf(parseAnomalyReward(obs([res('metal', 1)])))).toMatchObject({
      xpByLifeform: null,
    });
  });

  it('reads ships only, matching the attribute among others', () => {
    const r = parseAnomalyReward(obs([ship(['class', 'transportersmall'], 3)]));
    expect(eventOf(r)).toMatchObject({
      resources: { metal: 0, crystal: 0, deuterium: 0 },
      ships: { '202': 3 },
    });
  });

  it('sums repeated resources and ships', () => {
    const r = parseAnomalyReward(
      obs([
        res('metal', 100),
        res('crystal', 5),
        res('metal', 200),
        ship(['fighterlight'], 2),
        ship(['transportersmall'], 1),
        ship(['fighterlight'], 4),
      ]),
    );
    expect(eventOf(r)).toMatchObject({
      resources: { metal: 300, crystal: 5, deuterium: 0 },
      ships: { '204': 6, '202': 1 },
    });
  });

  it('sets anomalyCoords to null when absent or invalid', () => {
    expect(eventOf(parseAnomalyReward(obs([res('metal', 1)], null)))).toMatchObject({
      anomalyCoords: null,
    });
    expect(eventOf(parseAnomalyReward(obs([res('metal', 1)], 'x')))).toMatchObject({
      anomalyCoords: null,
    });
  });

  it.each([
    ['missing x-loot', withRaw(base, { messagetype: '76' })],
    ['invalid json', obs('{')],
    ['wrong shape', obs({ a: 1 })],
    ['empty array', obs([])],
    ['null amount', obs([res('metal', null)])],
    ['negative amount', obs([res('metal', -1)])],
    ['unknown resource', obs([res('lithium', 5)])],
    ['unknown ship', obs([ship(['mystery'], 1)])],
    ['ship without attribute', obs([ship([], 1)])],
    ['ambiguous ship', obs([ship(['fighterlight', 'cruiser'], 1)])],
    ['icon-less item', obs([res('metal', 1), { type: 'unknown', tag: 'span', amount: null }])],
    ['unknown entry', obs([res('metal', 1), { type: 'unknown', tag: 'x-icon', amount: 2 }])],
    ['experience as a loot resource', obs([res('speciesExperience', 10)])],
    ['invalid x-xp json', obs([res('metal', 1)], '3:44:7', '[')],
    ['wrong x-xp shape', obs([res('metal', 1)], '3:44:7', { a: 1 })],
    ['unreadable experience', obs([res('metal', 1)], '3:44:7', [xp(1, null)])],
    ['experience without lifeform', obs([res('metal', 1)], '3:44:7', [xp(null, 10)])],
  ])('is unrecognized: %s', (_name, o) => {
    const r = parseAnomalyReward(o);
    expect(r.status).toBe('unrecognized');
    expect(reasonOf(r)).toBeTruthy();
  });

  it('is unrecognized without a valid timestamp', () => {
    const r = parseAnomalyReward(withRaw(obs([res('metal', 1)]), { timestamp: undefined }));
    expect(r.status).toBe('unrecognized');
  });
});
