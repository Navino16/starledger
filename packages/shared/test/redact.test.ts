import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MessageObservation, Observation } from '../src/observation';
import { parseMessage } from '../src/parsers';
import { redactObservation } from '../src/redact';
import { loadFixtures, withRaw } from './parsers/helpers';

const realDir = join(import.meta.dirname, 'fixtures/messages-real');
const fixtures = [...loadFixtures('', realDir), ...loadFixtures('')].filter((f) =>
  [25, 33, 48, 76].includes(f.observation.messageType ?? -1),
);

type Entity = {
  id?: unknown;
  name?: unknown;
  tag?: unknown;
  alliance?: { id?: unknown; name?: unknown; tag?: unknown } | null;
};

function otherIdentifiers(obs: MessageObservation) {
  const own = obs.account.playerId;
  const names = new Set<string>();
  const ids = new Set<number>();
  const add = (e: Entity | undefined | null) => {
    if (!e) return;
    if (typeof e.id === 'number') ids.add(e.id);
    for (const n of [e.name, e.tag, e.alliance?.name, e.alliance?.tag]) {
      if (typeof n === 'string' && n !== '') names.add(n);
    }
    if (typeof e.alliance?.id === 'number') ids.add(e.alliance.id);
  };
  const fleets = obs.raw.fleets
    ? (JSON.parse(obs.raw.fleets) as { player?: Entity; spaceObject?: Entity }[])
    : [];
  for (const f of fleets) {
    if (f.player?.id === own) continue;
    add(f.player);
    add(f.spaceObject);
  }
  const defender = obs.raw.defenderspaceobject
    ? (JSON.parse(obs.raw.defenderspaceobject) as {
        type?: string;
        name?: string;
        id?: number;
        owner?: Entity;
      })
    : null;
  if (defender && defender.type !== 'anomaly' && defender.owner?.id !== own) {
    add(defender);
    add(defender.owner);
  }
  for (const side of ['source', 'target']) {
    if (obs.raw[`${side}playerid`] === String(own)) continue;
    for (const k of ['playerid', 'planetid']) {
      const v = obs.raw[`${side}${k}`];
      if (v) ids.add(Number(v));
    }
    for (const k of ['playername', 'planetname']) {
      const v = obs.raw[`${side}${k}`];
      if (v) names.add(v);
    }
  }
  for (const k of ['targetplanetid']) {
    if (obs.messageType === 48 && obs.raw[k]) ids.add(Number(obs.raw[k]));
  }
  if (obs.messageType === 48 && obs.raw.targetplanetname) names.add(obs.raw.targetplanetname);
  return { names, ids };
}

const messageOf = (o: Observation): MessageObservation => {
  if (o.kind !== 'message') throw new Error('not a message');
  return o;
};

describe('redactObservation on fixtures', () => {
  it('covers the four message types', () => {
    const types = new Set(fixtures.map((f) => f.observation.messageType));
    expect([...types].sort()).toEqual([25, 33, 48, 76]);
  });

  it.each(fixtures.map((f) => [f.file, f] as const))(
    '%s: no other player identifier left',
    (_n, f) => {
      const { names, ids } = otherIdentifiers(f.observation);
      const redacted = messageOf(redactObservation(f.observation));
      const serialized = JSON.stringify(redacted);
      for (const name of names) expect(serialized, name).not.toContain(name);
      for (const id of ids) {
        expect(serialized, `id ${id}`).not.toMatch(new RegExp(`\\\\"id\\\\":${id}(?!\\d)`));
        for (const [k, v] of Object.entries(redacted.raw)) {
          if (/id$/.test(k)) expect(v, k).not.toBe(String(id));
        }
      }
    },
  );

  it.each(fixtures.map((f) => [f.file, f] as const))('%s: own data is intact', (_n, f) => {
    const own = f.observation.account;
    const redacted = messageOf(redactObservation(f.observation));
    expect(redacted.account).toEqual(own);
    expect(redacted.raw.coords).toBe(f.observation.raw.coords);
    expect(redacted.raw.timestamp).toBe(f.observation.raw.timestamp);
    for (const [k, v] of Object.entries(f.observation.raw)) {
      if (k.endsWith('playerid') && v === String(own.playerId)) expect(redacted.raw[k]).toBe(v);
    }
    if (f.observation.messageType === 33) {
      for (const side of ['source', 'target']) {
        if (f.observation.raw[`${side}playerid`] !== String(own.playerId)) continue;
        for (const k of [
          'playername',
          'planetid',
          'planetname',
          'planetcoordinates',
          'planettype',
          'planeticon',
        ]) {
          expect(redacted.raw[`${side}${k}`]).toBe(f.observation.raw[`${side}${k}`]);
        }
      }
    }
  });

  it.each(fixtures.map((f) => [f.file, f] as const))('%s: idempotent and pure', (_n, f) => {
    const before = JSON.stringify(f.observation);
    const once = redactObservation(f.observation);
    expect(JSON.stringify(f.observation)).toBe(before);
    expect(redactObservation(once)).toEqual(once);
  });

  it.each(fixtures.map((f) => [f.file, f] as const))('%s: parses to the same event', (_n, f) => {
    expect(parseMessage(redactObservation(f.observation) as MessageObservation)).toEqual(
      f.expected,
    );
  });
});

describe('redactObservation rules', () => {
  const combat = fixtures.find((f) => f.file === 'combat-raid-loot.json')
    ?.observation as MessageObservation;
  const transport = fixtures.find((f) => f.file === 'transport-delivered.json')
    ?.observation as MessageObservation;
  const own = combat.account.playerId;

  it('keeps combat coordinates, rounds and fleet compositions', () => {
    const out = messageOf(redactObservation(combat));
    expect(out.raw.coords).toBe(combat.raw.coords);
    expect(out.raw.combatrounds).toBe(combat.raw.combatrounds);
    expect(out.raw.result).toBe(combat.raw.result);
    const fleets = JSON.parse(out.raw.fleets ?? '[]') as Record<string, unknown>[];
    const other = fleets.find((f) => f.side === 'attacker');
    expect(other).toEqual({
      side: 'attacker',
      fleetId: 1,
      combatTechnologies: [{ technologyId: 219, amount: 9 }],
    });
    const mine = fleets.find((f) => f.side === 'defender');
    expect(mine).toHaveProperty('player.id', own);
    expect(mine).toHaveProperty('spaceObject');
  });

  it('reduces a foreign defender to type and coordinates', () => {
    const defender = JSON.stringify({
      id: 5,
      type: 'planet',
      name: 'Foreign',
      coordinates: { galaxy: 1, system: 2, position: 3 },
      owner: { id: 999, name: 'Stranger' },
    });
    const out = messageOf(redactObservation(withRaw(combat, { defenderspaceobject: defender })));
    expect(JSON.parse(out.raw.defenderspaceobject ?? '')).toEqual({
      type: 'planet',
      coordinates: { galaxy: 1, system: 2, position: 3 },
    });
  });

  it('keeps an anomaly defender untouched', () => {
    const defender = JSON.stringify({ id: 5, type: 'anomaly', name: 'A', owner: { id: 999 } });
    const out = messageOf(redactObservation(withRaw(combat, { defenderspaceobject: defender })));
    expect(out.raw.defenderspaceobject).toBe(defender);
  });

  it.each(['fleets', 'defenderspaceobject'])('drops an invalid JSON %s', (key) => {
    const out = messageOf(redactObservation(withRaw(combat, { [key]: '{not json' })));
    expect(out.raw).not.toHaveProperty(key);
  });

  it('drops the target planet of a one-round combat but keeps its coordinates', () => {
    const short: MessageObservation = {
      ...combat,
      messageType: 48,
      raw: {
        coords: '2:271:14',
        targetplanetcoordinates: '2:271:14',
        targetplanetid: '1001',
        targetplanetname: 'Planet A',
        shipslost: '{"210":20}',
      },
    };
    expect(messageOf(redactObservation(short)).raw).toEqual({
      coords: '2:271:14',
      targetplanetcoordinates: '2:271:14',
      shipslost: '{"210":20}',
    });
  });

  it('drops both sides of a transport between two other players', () => {
    const out = messageOf(
      redactObservation(
        withRaw(transport, { sourceplayerid: '200002', sourceplayername: 'Other2' }),
      ),
    );
    for (const side of ['source', 'target']) {
      for (const k of [
        'playerid',
        'playername',
        'planetid',
        'planetname',
        'planetcoordinates',
        'planettype',
        'planeticon',
      ]) {
        expect(out.raw).not.toHaveProperty(`${side}${k}`);
      }
    }
    expect(out.raw.cargo).toBe(transport.raw.cargo);
  });

  it('treats a transport side without player id as not own', () => {
    const out = messageOf(redactObservation(withRaw(transport, { targetplayerid: undefined })));
    expect(out.raw).not.toHaveProperty('targetplayername');
    expect(out.raw).not.toHaveProperty('targetplanetid');
  });

  it('drops targetplayer* and targetplanet* of an anomaly reward aimed at another player', () => {
    const reward = messageOf(
      redactObservation({
        ...transport,
        messageType: 76,
        raw: {
          coords: '2:34:5',
          targetplanetid: '9',
          targetplayerid: '200001',
          targetplayername: 'Other1',
          targetplanetname: 'P',
          targetplanetcoordinates: '1:1:1',
          'x-loot': '[]',
        },
      }),
    );
    expect(reward.raw).toEqual({ coords: '2:34:5', 'x-loot': '[]' });
  });

  it('drops any *playername whose id is missing or not own, whatever the type', () => {
    const obs: MessageObservation = {
      ...combat,
      messageType: 32,
      raw: {
        aplayername: 'Alone',
        bplayerid: '12',
        bplayername: 'Foreign',
        cplayerid: String(own),
        cplayername: 'Me',
      },
    };
    expect(messageOf(redactObservation(obs)).raw).toEqual({
      bplayerid: '12',
      cplayerid: String(own),
      cplayername: 'Me',
    });
  });

  it('returns other observation kinds unchanged', () => {
    const dispatch: Observation = {
      kind: 'fleet_dispatch',
      clientObservationId: '00000000-0000-4000-8000-000000000001',
      account: combat.account,
      observedAt: 1,
      serverUtcOffsetMinutes: 0,
      source: 'fleetdispatch',
      mission: 1,
      origin: null,
      target: { galaxy: 1, system: 1, position: 1, type: 1 },
      ships: {},
      consumption: null,
      sentAt: 1,
    };
    expect(redactObservation(dispatch)).toBe(dispatch);
  });
});
