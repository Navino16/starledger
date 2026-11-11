import { randomUUID } from 'node:crypto';
import type { BatchAck, MessageObservation, Observation } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { generateApiKey } from '../src/auth/api-keys';
import type { Config } from '../src/config';
import { canonicalJson } from '../src/ingest/canonical';
import { ingestBatch, type LaxBatch } from '../src/ingest/ingest';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';

const config: Config = {
  databaseUrl: 'unused',
  sessionSecret: 'ab'.repeat(32),
  port: 3000,
  publicUrl: 'http://localhost:3000',
  trustProxy: false,
  openSignup: false,
};

let t: TestDb;
let app: FastifyInstance;
let aliceId: string;
let bobId: string;
let aliceKey: string;
let nextMsgId = 10_000;

const deviceA = randomUUID();
const deviceB = randomUUID();

function expedition(
  overrides: Partial<MessageObservation> = {},
  rawPatch = {},
): MessageObservation {
  return {
    kind: 'message',
    clientObservationId: randomUUID(),
    account: { serverId: 808, lang: 'en', playerId: 100001, playerName: 'Tester' },
    observedAt: 1_790_000_160_000,
    serverUtcOffsetMinutes: 60,
    msgId: nextMsgId++,
    messageType: 41,
    subtabId: 22,
    raw: {
      messagetype: '41',
      timestamp: '1790000100',
      coords: '4:100:16',
      expeditionresult: 'ressources',
      size: '2',
      depletion: '1',
      resourcesgained: '{"metal":1200,"crystal":600}',
      ...rawPatch,
    },
    ...overrides,
  };
}

const batch = (observations: unknown[], deviceId = deviceA): LaxBatch => ({
  clientVersion: '0.1.0',
  deviceId,
  observations,
});

const send = (userId: string, observations: unknown[], deviceId = deviceA) =>
  ingestBatch(t.db, userId, batch(observations, deviceId));

const statuses = (ack: BatchAck) => ack.results.map((r) => r.status);

async function eventsOf(userId: string, externalKey: string) {
  return t.db
    .selectFrom('events')
    .innerJoin('accounts', 'accounts.id', 'events.account_id')
    .selectAll('events')
    .where('accounts.user_id', '=', userId)
    .where('events.external_key', '=', externalKey)
    .execute();
}

beforeAll(async () => {
  t = await startTestDb();
  const mk = (username: string) =>
    createUser(t.db, { username, password: 'correct horse battery', isAdmin: false, locale: 'en' });
  const alice = await mk('alice');
  const bob = await mk('bob');
  aliceId = alice.id;
  bobId = bob.id;
  aliceKey = await generateApiKey(t.db, alice.id);
  app = buildApp(config, t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

describe('canonicalJson', () => {
  it('sorts keys recursively and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}',
    );
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });
});

describe('ingestBatch', () => {
  it('accepts a new message and stores observation and event', async () => {
    const obs = expedition();
    const ack = await send(aliceId, [obs]);
    expect(ack.results).toEqual([
      { clientObservationId: obs.clientObservationId, status: 'accepted' },
    ]);
    const [event] = await eventsOf(aliceId, `msg:${obs.msgId}`);
    expect(event?.status).toBe('ok');
    expect(event?.kind).toBe('expedition');
    expect(event?.day).toBe('2026-09-21');
    const device = await t.db
      .selectFrom('devices')
      .selectAll()
      .where('user_id', '=', aliceId)
      .executeTakeFirst();
    expect(device?.client_version).toBe('0.1.0');
  });

  it('returns duplicate for a resent clientObservationId', async () => {
    const obs = expedition();
    await send(aliceId, [obs]);
    expect(statuses(await send(aliceId, [obs]))).toEqual(['duplicate']);
  });

  it('returns duplicate when another device sees the same message, with a single event', async () => {
    const first = expedition();
    await send(aliceId, [first], deviceA);
    const second = { ...first, clientObservationId: randomUUID() };
    expect(statuses(await send(aliceId, [second], deviceB))).toEqual(['duplicate']);
    expect(await eventsOf(aliceId, `msg:${first.msgId}`)).toHaveLength(1);
  });

  it('treats a localized name difference as a duplicate, not a conflict', async () => {
    const items = (name: string) => ({
      expeditionresult: 'items',
      resourcesgained: '',
      itemsgained: JSON.stringify([{ id: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', amount: 1, name }]),
    });
    const fr = expedition({}, items('Objet Bronze'));
    const en = {
      ...fr,
      clientObservationId: randomUUID(),
      raw: { ...fr.raw, ...items('Bronze Item') },
    };
    expect(statuses(await send(aliceId, [fr]))).toEqual(['accepted']);
    expect(statuses(await send(aliceId, [en], deviceB))).toEqual(['duplicate']);
  });

  it('flags different resources for the same msgId as conflict and keeps the first data', async () => {
    const first = expedition();
    await send(aliceId, [first]);
    const other = expedition(
      { msgId: first.msgId },
      { resourcesgained: '{"metal":1,"crystal":2}' },
    );
    expect(statuses(await send(aliceId, [other], deviceB))).toEqual(['conflict']);
    const [event] = await eventsOf(aliceId, `msg:${first.msgId}`);
    expect(event?.status).toBe('conflict');
    expect(event?.data).toMatchObject({ resources: { metal: 1200, crystal: 600 } });
    const again = { ...other, clientObservationId: randomUUID() };
    expect(statuses(await send(aliceId, [again]))).toEqual(['conflict']);
    const sameAsStored = { ...first, clientObservationId: randomUUID() };
    expect(statuses(await send(aliceId, [sameAsStored]))).toEqual(['duplicate']);
  });

  it('creates two events for different msgIds with identical gains', async () => {
    const a = expedition();
    const b = expedition();
    expect(statuses(await send(aliceId, [a, b]))).toEqual(['accepted', 'accepted']);
    expect(await eventsOf(aliceId, `msg:${a.msgId}`)).toHaveLength(1);
    expect(await eventsOf(aliceId, `msg:${b.msgId}`)).toHaveLength(1);
  });

  it('returns unrecognized for type 33 and keeps the raw payload', async () => {
    const obs = expedition({ messageType: 33 }, { messagetype: '33' });
    expect(statuses(await send(aliceId, [obs]))).toEqual(['unrecognized']);
    const row = await t.db
      .selectFrom('observations')
      .select('payload')
      .where('client_observation_id', '=', obs.clientObservationId)
      .executeTakeFirstOrThrow();
    expect((row.payload as MessageObservation).raw.resourcesgained).toBe(
      '{"metal":1200,"crystal":600}',
    );
    const [event] = await eventsOf(aliceId, `msg:${obs.msgId}`);
    expect(event?.status).toBe('unrecognized');
    expect(event?.data).toBeNull();
  });

  it('rejects an invalid observation and processes the others', async () => {
    const good = expedition();
    const ack = await send(aliceId, [{ kind: 'message', clientObservationId: 'nope' }, good]);
    expect(statuses(ack)).toEqual(['rejected', 'accepted']);
    expect(ack.results[0]?.clientObservationId).toBe('nope');
    expect(typeof ack.results[0]?.reason).toBe('string');
  });

  it('keeps a savepoint per observation so a failure does not undo the others', async () => {
    const good = expedition();
    const bad = expedition({
      account: { serverId: 808, lang: 'en', playerId: 2 ** 62, playerName: null },
    });
    const ack = await send(aliceId, [good, bad, expedition()]);
    expect(statuses(ack)).toEqual(['accepted', 'rejected', 'accepted']);
    expect(await eventsOf(aliceId, `msg:${good.msgId}`)).toHaveLength(1);
  });

  it('gives each user an own event for the same msgId', async () => {
    const obs = expedition();
    expect(statuses(await send(aliceId, [obs]))).toEqual(['accepted']);
    const bobObs = { ...obs, clientObservationId: randomUUID() };
    expect(statuses(await send(bobId, [bobObs]))).toEqual(['accepted']);
    const [a] = await eventsOf(aliceId, `msg:${obs.msgId}`);
    const [b] = await eventsOf(bobId, `msg:${obs.msgId}`);
    expect(a?.id).not.toBe(b?.id);
  });

  it('does not let a clientObservationId of another user collide', async () => {
    const obs = expedition();
    await send(aliceId, [obs]);
    expect(statuses(await send(bobId, [obs]))).toEqual(['accepted']);
  });

  it('counts a fleet dispatch once per clientObservationId', async () => {
    const dispatch: Observation = {
      kind: 'fleet_dispatch',
      clientObservationId: randomUUID(),
      account: { serverId: 808, lang: 'en', playerId: 100001, playerName: null },
      observedAt: 1_790_000_100_000,
      serverUtcOffsetMinutes: 60,
      source: 'fleetdispatch',
      mission: 15,
      origin: null,
      target: { galaxy: 1, system: 2, position: 16, type: 1 },
      ships: { '203': 5 },
      consumption: 10,
      sentAt: 1_790_000_000_000,
    };
    expect(statuses(await send(aliceId, [dispatch]))).toEqual(['accepted']);
    expect(statuses(await send(aliceId, [dispatch]))).toEqual(['duplicate']);
    const [event] = await eventsOf(aliceId, `fuel:${dispatch.clientObservationId}`);
    expect(event?.kind).toBe('fuel');
  });

  describe('unrecognized interpretations', () => {
    it('is a duplicate when an unrecognized event is seen unrecognized again', async () => {
      const obs = expedition({ messageType: 33 });
      await send(aliceId, [obs]);
      const again = { ...obs, clientObservationId: randomUUID() };
      expect(statuses(await send(aliceId, [again]))).toEqual(['duplicate']);
    });

    it('is replaced by a later ok reading, updating time, day and parser version', async () => {
      const bad = expedition({}, { timestamp: 'garbage' });
      expect(statuses(await send(aliceId, [bad]))).toEqual(['unrecognized']);
      const [before] = await eventsOf(aliceId, `msg:${bad.msgId}`);
      expect(before?.occurred_at).toBeNull();
      expect(before?.day).toBeNull();
      await t.db
        .updateTable('events')
        .set({ parser_version: 0 })
        .where('id', '=', before?.id as string)
        .execute();

      const good = expedition({ msgId: bad.msgId });
      expect(statuses(await send(aliceId, [good], deviceB))).toEqual(['accepted']);
      const [after] = await eventsOf(aliceId, `msg:${bad.msgId}`);
      expect(after?.status).toBe('ok');
      expect(after?.kind).toBe('expedition');
      expect(after?.occurred_at?.getTime()).toBe(1_790_000_100_000);
      expect(after?.day).toBe('2026-09-21');
      expect(after?.parser_version).toBeGreaterThan(0);
      expect(after?.data).toMatchObject({ kind: 'expedition' });
    });

    it('never downgrades or flags an existing ok or conflict event', async () => {
      const good = expedition();
      await send(aliceId, [good]);
      const weak = { ...good, clientObservationId: randomUUID(), messageType: 33 };
      expect(statuses(await send(aliceId, [weak]))).toEqual(['duplicate']);
      const [event] = await eventsOf(aliceId, `msg:${good.msgId}`);
      expect(event?.status).toBe('ok');
      expect(event?.data).toMatchObject({ kind: 'expedition' });

      const other = expedition({ msgId: good.msgId }, { resourcesgained: '{"metal":9}' });
      await send(aliceId, [other]);
      const weak2 = { ...good, clientObservationId: randomUUID(), messageType: 33 };
      expect(statuses(await send(aliceId, [weak2]))).toEqual(['duplicate']);
      const [flagged] = await eventsOf(aliceId, `msg:${good.msgId}`);
      expect(flagged?.status).toBe('conflict');
    });
  });

  describe('account upsert', () => {
    it('keeps a known player name when a later observation has none', async () => {
      const named = expedition({
        account: { serverId: 900, lang: 'en', playerId: 7, playerName: 'Known' },
      });
      await send(aliceId, [named]);
      const anon = expedition({
        account: { serverId: 900, lang: 'en', playerId: 7, playerName: null },
      });
      await send(aliceId, [anon]);
      const getName = () =>
        t.db
          .selectFrom('accounts')
          .select('player_name')
          .where('user_id', '=', aliceId)
          .where('server_id', '=', 900)
          .executeTakeFirst();
      expect((await getName())?.player_name).toBe('Known');
      const renamed = expedition({
        account: { serverId: 900, lang: 'en', playerId: 7, playerName: 'Renamed' },
      });
      await send(aliceId, [renamed]);
      expect((await getName())?.player_name).toBe('Renamed');
    });
  });

  it('takes devices.client_version from the body', async () => {
    const device = randomUUID();
    await ingestBatch(t.db, aliceId, {
      clientVersion: '1.2.3',
      deviceId: device,
      observations: [],
    });
    const row = await t.db
      .selectFrom('devices')
      .select('client_version')
      .where('device_id', '=', device)
      .executeTakeFirst();
    expect(row?.client_version).toBe('1.2.3');
  });
});

describe('POST /api/v1/observations', () => {
  const post = (payload: unknown, key = aliceKey) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/observations',
      headers: {
        authorization: `Bearer ${key}`,
        'x-client-version': '0.1.0',
        'content-type': 'application/json',
      },
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });

  it('returns the ack for a valid batch', async () => {
    const obs = expedition();
    const res = await post(batch([obs]));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      results: [{ clientObservationId: obs.clientObservationId, status: 'accepted' }],
    });
  });

  it('requires a valid key', async () => {
    const res = await post(batch([]), 'slk_bad');
    expect(res.statusCode).toBe(401);
  });

  it('rejects an invalid envelope with 400 invalid_payload', async () => {
    for (const body of [
      {},
      { clientVersion: '0.1.0', deviceId: 'not-a-uuid', observations: [] },
      { clientVersion: '0.1.0', deviceId: deviceA, observations: 'x' },
      batch(Array.from({ length: 201 }, () => ({}))),
      '{not json',
    ]) {
      const res = await post(body);
      expect(res.statusCode, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(res.json().error).toBe('invalid_payload');
    }
  });

  it('returns a JSON 413 above 2 MB', async () => {
    const res = await post(`{"pad":"${'a'.repeat(2 * 1024 * 1024)}"}`);
    expect(res.statusCode).toBe(413);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.json().error).toBe('payload_too_large');
  });
});
