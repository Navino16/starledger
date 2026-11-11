import { describe, expect, it } from 'vitest';
import { parseCombat, parseShortCombat } from '../../src/parsers/combat';
import { loadFixtures, observationOf, withRaw } from './helpers';

const fixtures = loadFixtures('combat-');
const longFixtures = fixtures.filter((f) => !f.file.startsWith('combat-short-'));
const shortFixtures = fixtures.filter((f) => f.file.startsWith('combat-short-'));
const attackWon = observationOf(fixtures, 'combat-attack-won.json');
const defenseLost = observationOf(fixtures, 'combat-defense-lost.json');
const short = observationOf(fixtures, 'combat-short-ships.json');

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
