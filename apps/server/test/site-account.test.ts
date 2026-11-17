import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { authenticateApiKey, createApiKey } from '../src/auth/api-keys';
import { createUser, verifyCredentials } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';
import { siteClient, testConfig } from './helpers/site';

const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'another long password';

let t: TestDb;
let app: FastifyInstance;
let aliceId: string;
let bobId: string;

const VALID = {
  msuRatio: [2.5, 1.5, 1],
  expeditionShipRatio: 80,
  anomalyShipRatio: 50,
  ignoreExpeShipsLoss: true,
  ignoreConsumption: false,
  includeTradesInBalance: true,
};

beforeAll(async () => {
  t = await startTestDb();
  aliceId = (
    await createUser(t.db, { username: 'alice', password: PASSWORD, isAdmin: false, locale: 'en' })
  ).id;
  bobId = (
    await createUser(t.db, { username: 'bob', password: PASSWORD, isAdmin: false, locale: 'en' })
  ).id;
  for (const [userId, serverId, lang] of [
    [aliceId, 285, 'fr'],
    [aliceId, 172, 'en'],
    [bobId, 214, 'de'],
  ] as const) {
    await t.db
      .insertInto('accounts')
      .values({ user_id: userId, server_id: serverId, lang, player_id: 1 })
      .execute();
  }
  app = buildApp(testConfig(), t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

describe('anonymous access', () => {
  it('answers 401 unauthenticated on every account route', async () => {
    const client = siteClient(app);
    await client.session();
    const calls = [
      client.call('GET', '/api-keys'),
      client.call('POST', '/api-keys', { name: 'PC' }),
      client.call('DELETE', `/api-keys/${randomUUID()}`),
      client.call('POST', '/password', { current: PASSWORD, next: NEW_PASSWORD }),
      client.call('GET', '/settings'),
      client.call('PUT', '/settings/285/fr', VALID),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: 'unauthenticated' });
    }
  });
});

describe('api keys', () => {
  it('creates, lists and deletes keys', async () => {
    const client = siteClient(app);
    await client.login('alice', PASSWORD);
    const created = await client.call('POST', '/api-keys', { name: ' PC ' });
    expect(created.statusCode).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    const { id, key } = created.json();
    expect(await authenticateApiKey(t.db, key)).toEqual({ userId: aliceId });

    const list = await client.call('GET', '/api-keys');
    expect(list.json().keys).toEqual([
      {
        id,
        name: 'PC',
        prefix: key.slice(0, 8),
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        lastUsedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    ]);
    expect(list.body).not.toContain(key);

    expect((await client.call('DELETE', `/api-keys/${id}`)).statusCode).toBe(204);
    expect(await authenticateApiKey(t.db, key)).toBeNull();
    expect((await client.call('DELETE', `/api-keys/${id}`)).statusCode).toBe(404);
  });

  it("refuses an empty name and another user's key", async () => {
    const bob = await createApiKey(t.db, bobId, 'Bob');
    const client = siteClient(app);
    await client.login('alice', PASSWORD);
    const empty = await client.call('POST', '/api-keys', { name: '   ' });
    expect(empty.statusCode).toBe(400);
    expect(empty.json()).toEqual({ error: 'name_invalid' });
    const other = await client.call('DELETE', `/api-keys/${bob.id}`);
    expect(other.statusCode).toBe(404);
    expect(other.json()).toEqual({ error: 'not_found' });
    expect(await authenticateApiKey(t.db, bob.key)).toEqual({ userId: bobId });
  });
});

describe('password change', () => {
  it('keeps the current session and signs out the others', async () => {
    await createUser(t.db, { username: 'carol', password: PASSWORD, isAdmin: false, locale: 'en' });
    const current = siteClient(app);
    const other = siteClient(app);
    await current.login('carol', PASSWORD);
    await other.login('carol', PASSWORD);

    const wrong = await current.call('POST', '/password', {
      current: 'wrong password!',
      next: NEW_PASSWORD,
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json()).toEqual({ error: 'current_invalid' });
    const short = await current.call('POST', '/password', { current: PASSWORD, next: 'short' });
    expect(short.json()).toEqual({ error: 'password_short' });

    const res = await current.call('POST', '/password', { current: PASSWORD, next: NEW_PASSWORD });
    expect(res.statusCode).toBe(204);
    expect((await current.session()).user?.username).toBe('carol');
    expect((await other.session()).user).toBeNull();
    expect(await verifyCredentials(t.db, 'carol', NEW_PASSWORD)).not.toBeNull();
  });
});

describe('settings', () => {
  it("lists the user's universes with their settings", async () => {
    const client = siteClient(app);
    await client.login('alice', PASSWORD);
    const res = await client.call('GET', '/settings');
    expect(res.statusCode).toBe(200);
    const { universes } = res.json();
    expect(universes.map((u: { serverId: number; lang: string }) => [u.serverId, u.lang])).toEqual([
      [172, 'en'],
      [285, 'fr'],
    ]);
    expect(universes[0].settings.msuRatio).toHaveLength(3);
  });

  it('saves valid settings and reads them back', async () => {
    const client = siteClient(app);
    await client.login('alice', PASSWORD);
    const res = await client.call('PUT', '/settings/285/fr', VALID);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ settings: VALID });
    const saved = (await client.call('GET', '/settings'))
      .json()
      .universes.find((u: { serverId: number }) => u.serverId === 285);
    expect(saved.settings).toEqual(VALID);
  });

  it('rejects invalid values and foreign or malformed universes', async () => {
    const client = siteClient(app);
    await client.login('alice', PASSWORD);
    const invalid = await client.call('PUT', '/settings/285/fr', {
      ...VALID,
      msuRatio: [0, 1, 1],
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: 'settings_invalid' });
    for (const path of ['/settings/214/de', '/settings/abc/fr', '/settings/285/FR!']) {
      expect((await client.call('PUT', path, VALID)).statusCode).toBe(404);
    }
  });
});
