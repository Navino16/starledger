import { randomUUID } from 'node:crypto';
import {
  computeStats,
  DEFAULT_VALUATION,
  type MessageObservation,
  type Observation,
  type StatsResponse,
} from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { generateApiKey } from '../src/auth/api-keys';
import type { Config } from '../src/config';
import { ingestBatch } from '../src/ingest/ingest';
import { saveValuationSettings } from '../src/settings/settings';
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

const TODAY = '2026-09-21';
const TODAY_TS = 1_790_000_100;
const DAY_S = 86_400;
const deviceId = randomUUID();

let t: TestDb;
let app: FastifyInstance;
let aliceId: string;
let bobId: string;
let aliceKey: string;
let bobKey: string;
let nextMsgId = 50_000;
let nextPlayerId = 200_000;

function account(playerId: number) {
  return { serverId: 808, lang: 'en', playerId, playerName: null };
}

function expedition(
  playerId: number,
  timestamp: number,
  rawPatch: Record<string, string> = {},
  msgId = nextMsgId++,
): MessageObservation {
  return {
    kind: 'message',
    clientObservationId: randomUUID(),
    account: account(playerId),
    observedAt: timestamp * 1000 + 60_000,
    serverUtcOffsetMinutes: 60,
    msgId,
    messageType: 41,
    subtabId: 22,
    raw: {
      messagetype: '41',
      timestamp: String(timestamp),
      coords: '4:100:16',
      expeditionresult: 'ressources',
      size: '2',
      depletion: '1',
      resourcesgained: '{"metal":1200,"crystal":600}',
      ...rawPatch,
    },
  };
}

const send = (userId: string, observations: Observation[]) =>
  ingestBatch(t.db, userId, { clientVersion: '0.1.0', deviceId, observations });

const get = (query: Record<string, string>, key: string | null = aliceKey) =>
  app.inject({
    method: 'GET',
    url: '/api/v1/stats',
    query,
    headers: {
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      'x-client-version': '0.1.0',
    },
  });

const q = (playerId: number, extra: Record<string, string> = {}) => ({
  serverId: '808',
  lang: 'en',
  playerId: String(playerId),
  period: 'all',
  today: TODAY,
  ...extra,
});

beforeAll(async () => {
  t = await startTestDb();
  const mk = (username: string) =>
    createUser(t.db, { username, password: 'correct horse battery', isAdmin: false, locale: 'en' });
  const alice = await mk('alice');
  const bob = await mk('bob');
  aliceId = alice.id;
  bobId = bob.id;
  aliceKey = await generateApiKey(t.db, alice.id);
  bobKey = await generateApiKey(t.db, bob.id);
  app = buildApp(config, t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

describe('GET /api/v1/stats', () => {
  it('requires an API key', async () => {
    const res = await get(q(1), null);
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('invalid_key');
  });

  it('counts one expedition for the day and two for all', async () => {
    const p = nextPlayerId++;
    await send(aliceId, [expedition(p, TODAY_TS), expedition(p, TODAY_TS - DAY_S)]);
    const day = (await get(q(p, { period: 'day' }))).json<StatsResponse>();
    expect(day.period).toBe('day');
    expect(day.range).toEqual({ from: TODAY, to: TODAY });
    expect(day.summary.expeditions.count).toBe(1);
    const all = (await get(q(p))).json<StatsResponse>();
    expect(all.range).toBeNull();
    expect(all.summary.expeditions.count).toBe(2);
    expect(all.counts).toEqual({ unrecognized: 0 });
    expect(all.settings).toEqual(DEFAULT_VALUATION);
    expect(typeof all.generatedAt).toBe('number');
  });

  it('computes week and month ranges from today', async () => {
    const p = nextPlayerId++;
    await send(aliceId, [
      expedition(p, TODAY_TS - 3 * DAY_S),
      expedition(p, TODAY_TS - 30 * DAY_S),
    ]);
    const week = (await get(q(p, { period: 'week' }))).json<StatsResponse>();
    expect(week.range).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(week.summary.expeditions.count).toBe(0);
    const month = (await get(q(p, { period: 'month' }))).json<StatsResponse>();
    expect(month.range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(month.summary.expeditions.count).toBe(1);
  });

  it('applies the caller settings to the summary', async () => {
    const p = nextPlayerId++;
    await send(aliceId, [
      {
        kind: 'fleet_dispatch',
        clientObservationId: randomUUID(),
        account: account(p),
        observedAt: 1_790_000_100_000,
        serverUtcOffsetMinutes: 60,
        source: 'fleetdispatch',
        mission: 15,
        origin: null,
        target: { galaxy: 1, system: 2, position: 16, type: 1 },
        ships: { '203': 5 },
        consumption: 10,
        sentAt: 1_790_000_000_000,
      },
    ]);
    const before = (await get(q(p))).json<StatsResponse>();
    expect(before.summary.balance.fuel.losses.deuterium).toBe(10);
    await saveValuationSettings(t.db, aliceId, 808, 'en', {
      ...DEFAULT_VALUATION,
      msuRatio: [...DEFAULT_VALUATION.msuRatio],
      ignoreConsumption: true,
    });
    const after = (await get(q(p))).json<StatsResponse>();
    expect(after.settings.ignoreConsumption).toBe(true);
    expect(after.summary.balance.fuel.losses.deuterium).toBe(0);
  });

  it('counts conflict events', async () => {
    const p = nextPlayerId++;
    const first = expedition(p, TODAY_TS);
    await send(aliceId, [first]);
    await send(aliceId, [
      expedition(p, TODAY_TS, { resourcesgained: '{"metal":1,"crystal":2}' }, first.msgId),
    ]);
    const status = await t.db
      .selectFrom('events')
      .select('status')
      .where('external_key', '=', `msg:${first.msgId}`)
      .execute();
    expect(status.map((s) => s.status)).toContain('conflict');
    const res = (await get(q(p))).json<StatsResponse>();
    expect(res.summary.expeditions.count).toBe(1);
  });

  it('counts unrecognized events regardless of period without using their data', async () => {
    const p = nextPlayerId++;
    await send(aliceId, [
      { ...expedition(p, TODAY_TS - 40 * DAY_S), messageType: 33 },
      expedition(p, TODAY_TS),
    ]);
    const res = (await get(q(p, { period: 'day' }))).json<StatsResponse>();
    expect(res.counts.unrecognized).toBe(1);
    expect(res.summary.expeditions.count).toBe(1);
  });

  it("returns an empty summary for another user's account", async () => {
    const p = nextPlayerId++;
    await send(aliceId, [expedition(p, TODAY_TS), { ...expedition(p, TODAY_TS), messageType: 33 }]);
    const res = await get(q(p), bobKey);
    expect(res.statusCode).toBe(200);
    const body = res.json<StatsResponse>();
    expect(body.summary).toEqual(computeStats([], DEFAULT_VALUATION));
    expect(body.counts.unrecognized).toBe(0);
  });

  it('keeps two users on the same account tuple separate', async () => {
    const p = nextPlayerId++;
    await send(aliceId, [expedition(p, TODAY_TS), expedition(p, TODAY_TS - DAY_S)]);
    await send(bobId, [expedition(p, TODAY_TS), { ...expedition(p, TODAY_TS), messageType: 33 }]);
    const alice = (await get(q(p))).json<StatsResponse>();
    expect(alice.summary.expeditions.count).toBe(2);
    expect(alice.counts.unrecognized).toBe(0);
    const bob = (await get(q(p), bobKey)).json<StatsResponse>();
    expect(bob.summary.expeditions.count).toBe(1);
    expect(bob.counts.unrecognized).toBe(1);
  });

  it('returns an empty summary for an unknown account', async () => {
    const res = await get(q(999_999_999));
    expect(res.statusCode).toBe(200);
    const body = res.json<StatsResponse>();
    expect(body.summary).toEqual(
      computeStats([], { ...DEFAULT_VALUATION, ignoreConsumption: true }),
    );
    expect(body.counts.unrecognized).toBe(0);
  });

  it.each([
    ['malformed today', { today: '21/09/2026' }],
    ['non-existent date', { today: '2026-02-31' }],
    ['empty today', { today: '' }],
    ['today with period all', { today: 'nope', period: 'all' }],
    ['bad period', { period: 'year' }],
    ['bad serverId', { serverId: '0' }],
    ['non numeric serverId', { serverId: 'abc' }],
    ['bad lang', { lang: 'EN1' }],
    ['bad playerId', { playerId: 'x' }],
  ])('rejects %s with 400 invalid_payload', async (_name, patch) => {
    const res = await get(q(1, patch));
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_payload');
  });

  it('rejects an absent today', async () => {
    const { today: _today, ...rest } = q(1);
    const res = await get(rest);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_payload');
  });
});
