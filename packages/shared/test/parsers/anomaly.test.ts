import { describe, expect, it } from 'vitest';
import { parseAnomalyReward } from '../../src/parsers/anomaly';
import { loadFixtures, observationOf, withRaw } from './helpers';

const base = observationOf(loadFixtures(''), 'recycling.json');
const obs = (loot: unknown, coords: string | null = '3:44:7') =>
  withRaw(base, {
    messagetype: '76',
    'x-loot': typeof loot === 'string' ? loot : JSON.stringify(loot),
    'x-anomalycoords': coords ?? undefined,
  });
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
    ['unknown entry', obs([res('metal', 1), { type: 'unknown', tag: 'x-icon', amount: 2 }])],
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
