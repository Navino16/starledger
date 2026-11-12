import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCombat, parseShortCombat } from '../../src/parsers/combat';
import { loadFixtures, observationOf, withRaw } from './helpers';

const fixtures = loadFixtures('combat-');
const longFixtures = fixtures.filter((f) => !f.file.startsWith('combat-short-'));
const shortFixtures = fixtures.filter((f) => f.file.startsWith('combat-short-'));
const attackWon = observationOf(fixtures, 'combat-attack-won.json');
const defenseLost = observationOf(fixtures, 'combat-defense-lost.json');
const short = observationOf(fixtures, 'combat-short-ships.json');
const realDir = join(import.meta.dirname, '../fixtures/messages-real');
const anomalyWon = observationOf(
  loadFixtures('combat-anomaly-', realDir),
  'combat-anomaly-won.json',
);

const eventOf = (r: ReturnType<typeof parseCombat>) => (r.status === 'ok' ? r.event : null);

describe('parseCombat', () => {
  it.each(longFixtures.map((f) => [f.file, f] as const))('%s matches expected', (_n, f) => {
    expect(parseCombat(f.observation)).toEqual(f.expected);
  });

  it('reports a draw with lootSign 0', () => {
    const result = JSON.stringify({
      winner: 'none',
      loot: { resources: [] },
      debris: { resources: [] },
      repairedTechnologies: [],
    });
    expect(eventOf(parseCombat(withRaw(attackWon, { result })))).toMatchObject({
      outcome: 'draw',
      lootSign: 0,
    });
  });

  it('reports an attacker loss with lootSign 0 when we attack', () => {
    const result = JSON.stringify({
      winner: 'defender',
      loot: { resources: [] },
      debris: { resources: [] },
      repairedTechnologies: [],
    });
    expect(eventOf(parseCombat(withRaw(attackWon, { result })))).toMatchObject({
      outcome: 'lost',
      lootSign: 0,
    });
  });

  it('is unrecognized when we are neither in fleets nor the defender owner', () => {
    const r = parseCombat(
      withRaw(attackWon, {
        fleets:
          '[{"fleetId":1,"side":"attacker","player":{"id":300003},"combatTechnologies":[{"technologyId":203}]}]',
      }),
    );
    expect(r).toMatchObject({ status: 'unrecognized', reason: 'own side not found' });
  });

  it.each(['fleets', 'combatrounds', 'result', 'defenderspaceobject'])(
    'is unrecognized naming %s when missing',
    (attr) => {
      const r = parseCombat(withRaw(attackWon, { [attr]: undefined }));
      expect(r.status).toBe('unrecognized');
      if (r.status === 'unrecognized') expect(r.reason).toContain(attr);
    },
  );

  it('rejects invalid result JSON', () => {
    expect(parseCombat(withRaw(attackWon, { result: '{nope' })).status).toBe('unrecognized');
  });

  it('rejects an unknown winner', () => {
    const result = JSON.stringify({
      winner: 'martians',
      loot: { resources: [] },
      debris: { resources: [] },
      repairedTechnologies: [],
    });
    expect(parseCombat(withRaw(attackWon, { result })).status).toBe('unrecognized');
  });

  it('treats an absent loot or debris as zero', () => {
    const base = JSON.parse(attackWon.raw.result ?? '{}');
    delete base.loot;
    delete base.debris;
    expect(
      eventOf(parseCombat(withRaw(attackWon, { result: JSON.stringify(base) }))),
    ).toMatchObject({
      loot: { metal: 0, crystal: 0, deuterium: 0 },
      debrisCreated: { metal: 0, crystal: 0, deuterium: 0 },
    });
  });

  it('subtracts no repair when an own defended planet lacks repairedTechnologies', () => {
    const base = JSON.parse(defenseLost.raw.result ?? '{}');
    delete base.repairedTechnologies;
    const r = eventOf(parseCombat(withRaw(defenseLost, { result: JSON.stringify(base) })));
    expect(r).toMatchObject({ ownPlanetDefended: true, shipsLost: { '204': 5 } });
  });

  it('flags an anomaly combat without treating the anomaly as an own planet', () => {
    expect(eventOf(parseCombat(anomalyWon))).toMatchObject({
      isAnomaly: true,
      ownPlanetDefended: false,
      ownSide: 'defender',
    });
  });

  it('flags a planet combat as not an anomaly', () => {
    expect(eventOf(parseCombat(defenseLost))).toMatchObject({ isAnomaly: false });
  });

  it('keeps defenses out of shipsLost', () => {
    expect(eventOf(parseCombat(defenseLost))).toMatchObject({ shipsLost: { '204': 3 } });
  });

  it('keeps a missing timestamp unrecognized with occurredAt null', () => {
    expect(parseCombat(withRaw(attackWon, { timestamp: undefined }))).toMatchObject({
      status: 'unrecognized',
      occurredAt: null,
    });
  });
});

describe('parseShortCombat', () => {
  it.each(shortFixtures.map((f) => [f.file, f] as const))('%s matches expected', (_n, f) => {
    expect(parseShortCombat(f.observation)).toEqual(f.expected);
  });

  it('flags position 16 as expedition', () => {
    const r = parseShortCombat(withRaw(short, { coords: '4:100:16' }));
    expect(r.status === 'ok' && r.event).toMatchObject({
      kind: 'combat_short',
      isExpedition: true,
    });
  });

  it('is unrecognized naming shipslost when missing', () => {
    const r = parseShortCombat(withRaw(short, { shipslost: undefined }));
    expect(r.status).toBe('unrecognized');
    if (r.status === 'unrecognized') expect(r.reason).toContain('shipslost');
  });

  it('is unrecognized on invalid coords', () => {
    expect(parseShortCombat(withRaw(short, { coords: 'x' })).status).toBe('unrecognized');
  });
});
