import { randomUUID } from 'node:crypto';
import {
  API_RATE_LIMIT_PER_MINUTE,
  type MessageObservation,
  type StatsResponse,
} from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { createApiKey } from '../src/auth/api-keys';
import { ingestBatch } from '../src/ingest/ingest';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';
import { siteClient, testConfig } from './helpers/site';

const PASSWORD = 'correct horse battery';
const TODAY = '2026-09-21';
const TODAY_TS = 1_790_000_100;

let t: TestDb;
let app: FastifyInstance;
let vegaId: string;
let vegaKey: string;

const expedition = (serverId: number, lang: string, playerId: number): MessageObservation => ({
  kind: 'message',
  clientObservationId: randomUUID(),
  account: { serverId, lang, playerId, playerName: playerId === 7 ? 'Vega' : null },
  observedAt: TODAY_TS * 1000 + 60_000,
  serverUtcOffsetMinutes: 60,
  msgId: 70_000 + playerId,
  messageType: 41,
  subtabId: 22,
  raw: {
    messagetype: '41',
    timestamp: String(TODAY_TS),
    coords: '4:100:16',
    expeditionresult: 'ressources',
    size: '2',
    depletion: '1',
    resourcesgained: '{"metal":1200,"crystal":600}',
  },
});

const statsQuery = (extra: Record<string, string> = {}) =>
  new URLSearchParams({
    serverId: '285',
    lang: 'fr',
    playerId: '7',
    period: 'month',
    today: TODAY,
    ...extra,
  }).toString();

beforeAll(async () => {
  t = await startTestDb();
  const vega = await createUser(t.db, {
    username: 'vega',
    password: PASSWORD,
    isAdmin: false,
    locale: 'fr',
  });
  await createUser(t.db, { username: 'orion', password: PASSWORD, isAdmin: false, locale: 'fr' });
  vegaId = vega.id;
  vegaKey = (await createApiKey(t.db, vegaId, 'PC')).key;
  await ingestBatch(t.db, vegaId, {
    clientVersion: '0.1.0',
    deviceId: randomUUID(),
    observations: [expedition(285, 'fr', 7), expedition(172, 'en', 9)],
  });
  app = buildApp(testConfig(), t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

describe('GET /api/site/accounts', () => {
  it("lists the user's own accounts, sorted", async () => {
    const vega = siteClient(app);
    await vega.login('vega', PASSWORD);
    const res = await vega.call('GET', '/accounts');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      accounts: [
        { serverId: 172, lang: 'en', playerId: 9, playerName: null },
        { serverId: 285, lang: 'fr', playerId: 7, playerName: 'Vega' },
      ],
    });
  });

  it("does not show another user's accounts", async () => {
    const orion = siteClient(app);
    await orion.login('orion', PASSWORD);
    expect((await orion.call('GET', '/accounts')).json()).toEqual({ accounts: [] });
  });

  it('needs a session', async () => {
    const res = await siteClient(app).call('GET', '/accounts');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthenticated' });
  });
});

describe('GET /api/site/stats', () => {
  it('answers like /api/v1/stats for the same account', async () => {
    const vega = siteClient(app);
    await vega.login('vega', PASSWORD);
    const site = (await vega.call('GET', `/stats?${statsQuery()}`)).json<StatsResponse>();
    const v1 = await app.inject({
      method: 'GET',
      url: `/api/v1/stats?${statsQuery()}`,
      headers: { authorization: `Bearer ${vegaKey}`, 'x-client-version': '0.1.0' },
    });
    const { generatedAt: _a, ...siteRest } = site;
    const { generatedAt: _b, ...v1Rest } = v1.json<StatsResponse>();
    expect(siteRest).toEqual(v1Rest);
    expect(site.summary.expeditions.count).toBe(1);
  });

  it("shows nothing of another user's account", async () => {
    const orion = siteClient(app);
    await orion.login('orion', PASSWORD);
    const res = await orion.call('GET', `/stats?${statsQuery()}`);
    expect(res.statusCode).toBe(200);
    expect(res.json<StatsResponse>().summary.expeditions.count).toBe(0);
  });

  it('rejects invalid parameters with 400 invalid_payload', async () => {
    const vega = siteClient(app);
    await vega.login('vega', PASSWORD);
    const invalid: Record<string, string>[] = [
      { period: 'year' },
      { today: '2026-02-31' },
      { serverId: 'abc' },
    ];
    for (const extra of invalid) {
      const res = await vega.call('GET', `/stats?${statsQuery(extra)}`);
      expect(res.statusCode, JSON.stringify(extra)).toBe(400);
      expect(res.json()).toEqual({ error: 'invalid_payload' });
    }
  });

  it('needs a session', async () => {
    const res = await siteClient(app).call('GET', `/stats?${statsQuery()}`);
    expect(res.statusCode).toBe(401);
  });

  it('limits each user to the API rate', async () => {
    const limited = buildApp(testConfig(), t.db);
    await limited.ready();
    const client = siteClient(limited);
    await client.login('vega', PASSWORD);
    let last = 0;
    for (let i = 0; i <= API_RATE_LIMIT_PER_MINUTE; i++) {
      last = (await client.call('GET', `/stats?${statsQuery({ period: 'day' })}`)).statusCode;
    }
    expect(last).toBe(429);
    await limited.close();
  });
});
