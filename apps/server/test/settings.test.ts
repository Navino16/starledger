import { DEFAULT_VALUATION, type ValuationSettings } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { getValuationSettings, saveValuationSettings } from '../src/settings/settings';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';
import { siteClient, testConfig } from './helpers/site';

const PASSWORD = 'correct horse battery';

let t: TestDb;
let app: FastifyInstance;
let aliceId: string;
let bobId: string;

beforeAll(async () => {
  t = await startTestDb();
  aliceId = (
    await createUser(t.db, { username: 'alice', password: PASSWORD, isAdmin: false, locale: 'en' })
  ).id;
  bobId = (
    await createUser(t.db, { username: 'bob', password: PASSWORD, isAdmin: false, locale: 'fr' })
  ).id;
  app = buildApp(testConfig(), t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

beforeEach(async () => {
  await t.db.deleteFrom('universe_settings').execute();
  await t.db.deleteFrom('accounts').execute();
});

async function login(username: string) {
  const client = siteClient(app);
  await client.login(username, PASSWORD);
  return client;
}

const addAccount = (userId: string, serverId = 808, lang = 'en') =>
  t.db
    .insertInto('accounts')
    .values({ user_id: userId, server_id: serverId, lang, player_id: 1, player_name: 'p' })
    .execute();

const valid: ValuationSettings = {
  msuRatio: [2.5, 1.5, 1],
  expeditionShipRatio: 50,
  anomalyShipRatio: 60,
  ignoreExpeShipsLoss: true,
  ignoreConsumption: false,
  includeTradesInBalance: false,
};

describe('valuation settings store', () => {
  it('returns a copy of the defaults when no row exists', async () => {
    const s = await getValuationSettings(t.db, aliceId, 808, 'en');
    expect(s).toEqual(DEFAULT_VALUATION);
    expect(s).not.toBe(DEFAULT_VALUATION);
    expect(s.msuRatio).not.toBe(DEFAULT_VALUATION.msuRatio);
  });

  it('round-trips decimal ratios exactly and upserts', async () => {
    const s = {
      msuRatio: [2.5, 1.5, 1] as [number, number, number],
      expeditionShipRatio: 40,
      anomalyShipRatio: 30,
      ignoreExpeShipsLoss: true,
      ignoreConsumption: false,
      includeTradesInBalance: true,
    };
    await saveValuationSettings(t.db, aliceId, 808, 'en', s);
    expect(await getValuationSettings(t.db, aliceId, 808, 'en')).toEqual(s);
    await saveValuationSettings(t.db, aliceId, 808, 'en', { ...s, msuRatio: [3.1, 2.2, 1.3] });
    expect((await getValuationSettings(t.db, aliceId, 808, 'en')).msuRatio).toEqual([
      3.1, 2.2, 1.3,
    ]);
    expect(await getValuationSettings(t.db, aliceId, 808, 'fr')).toEqual(DEFAULT_VALUATION);
  });
});

describe('GET /api/site/settings', () => {
  it("lists only the user's universes, with saved values or defaults", async () => {
    await addAccount(aliceId, 808, 'en');
    await addAccount(aliceId, 12, 'fr');
    await addAccount(bobId, 77, 'en');
    await saveValuationSettings(t.db, aliceId, 808, 'en', valid);
    const res = await (await login('alice')).call('GET', '/settings');
    expect(res.json()).toEqual({
      universes: [
        { serverId: 12, lang: 'fr', settings: DEFAULT_VALUATION },
        { serverId: 808, lang: 'en', settings: valid },
      ],
    });
  });

  it('is empty when the user has no accounts', async () => {
    const res = await (await login('alice')).call('GET', '/settings');
    expect(res.json()).toEqual({ universes: [] });
  });
});

describe('PUT /api/site/settings/:serverId/:lang', () => {
  it.each([
    ['zero ratio', { msuRatio: [0, 1.5, 1] }],
    ['denormal ratio', { msuRatio: [5e-324, 1.5, 1] }],
    ['negative ratio', { msuRatio: [2.5, -1, 1] }],
    ['huge ratio', { msuRatio: [2.5, 1.5, 101] }],
    ['non numeric ratio', { msuRatio: ['abc', 1.5, 1] }],
    ['missing ratio', { msuRatio: [2.5, 1.5] }],
    ['ship ratio above 100', { expeditionShipRatio: 101 }],
    ['negative ship ratio', { expeditionShipRatio: -1 }],
    ['fractional ship ratio', { expeditionShipRatio: 50.5 }],
    ['anomaly ratio above 100', { anomalyShipRatio: 101 }],
    ['negative anomaly ratio', { anomalyShipRatio: -1 }],
    ['fractional anomaly ratio', { anomalyShipRatio: 1.5 }],
    ['non boolean flag', { ignoreConsumption: 'on' }],
    ['unknown field', { extra: 1 }],
  ])('rejects a %s with 400 and saves nothing', async (_name, override) => {
    await addAccount(aliceId);
    const client = await login('alice');
    const res = await client.call('PUT', '/settings/808/en', { ...valid, ...override });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'settings_invalid' });
    expect(await getValuationSettings(t.db, aliceId, 808, 'en')).toEqual(DEFAULT_VALUATION);
  });

  it('accepts the ship and anomaly ratio bounds 0 and 100', async () => {
    await addAccount(aliceId);
    const client = await login('alice');
    for (const v of [0, 100]) {
      for (const field of ['expeditionShipRatio', 'anomalyShipRatio']) {
        const res = await client.call('PUT', '/settings/808/en', { ...valid, [field]: v });
        expect(res.statusCode).toBe(200);
      }
    }
  });

  it('answers 404 for a universe the user has no account on', async () => {
    await addAccount(aliceId);
    const client = await login('alice');
    for (const path of [
      '/settings/999/en',
      '/settings/808/xx',
      '/settings/abc/en',
      '/settings/2147483648/en',
      '/settings/808/%00',
      '/settings/808/EN',
      '/settings/0x328/en',
      '/settings/808.0/en',
    ]) {
      const res = await client.call('PUT', path, valid);
      expect(res.statusCode, path).toBe(404);
      expect(res.json()).toEqual({ error: 'not_found' });
    }
  });

  it("does not let another user modify a universe's settings", async () => {
    await addAccount(aliceId);
    const alice = { ...DEFAULT_VALUATION, expeditionShipRatio: 70 };
    await saveValuationSettings(t.db, aliceId, 808, 'en', alice);
    const res = await (await login('bob')).call('PUT', '/settings/808/en', valid);
    expect(res.statusCode).toBe(404);
    expect(await getValuationSettings(t.db, aliceId, 808, 'en')).toEqual(alice);
    expect(await getValuationSettings(t.db, bobId, 808, 'en')).toEqual(DEFAULT_VALUATION);
  });

  it('rejects a missing CSRF token with 403 and saves nothing', async () => {
    await addAccount(aliceId);
    const client = await login('alice');
    const res = await client.call('PUT', '/settings/808/en', valid, { csrf: false });
    expect(res.statusCode).toBe(403);
    expect(await getValuationSettings(t.db, aliceId, 808, 'en')).toEqual(DEFAULT_VALUATION);
  });
});
