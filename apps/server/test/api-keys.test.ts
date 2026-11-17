import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import {
  ApiKeyNameError,
  authenticateApiKey,
  createApiKey,
  listApiKeys,
  MAX_KEY_NAME_LENGTH,
  revokeApiKey,
} from '../src/auth/api-keys';
import type { Config } from '../src/config';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';

const PASSWORD = 'correct horse battery';
const form = { 'content-type': 'application/x-www-form-urlencoded' };

const config: Config = {
  databaseUrl: 'unused',
  sessionSecret: 'ab'.repeat(32),
  port: 3000,
  publicUrl: 'http://localhost:3000',
  trustProxy: ['loopback', 'linklocal', 'uniquelocal'],
  openSignup: false,
};

let t: TestDb;
let app: FastifyInstance;
let aliceId: string;
let bobId: string;
let ip = 0;

beforeAll(async () => {
  t = await startTestDb();
  aliceId = (
    await createUser(t.db, { username: 'alice', password: PASSWORD, isAdmin: false, locale: 'en' })
  ).id;
  bobId = (
    await createUser(t.db, { username: 'bob', password: PASSWORD, isAdmin: false, locale: 'fr' })
  ).id;
  app = buildApp(config, t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

const cookieOf = (res: { headers: Record<string, unknown> }) =>
  [res.headers['set-cookie'] ?? []]
    .flat()
    .map((c) => String(c).split(';')[0])
    .join('; ');
const csrfOf = (body: string) => /name="_csrf" value="([^"]+)"/.exec(body)?.[1] ?? '';

async function post(url: string, fields: Record<string, string>, cookie: string) {
  return app.inject({
    method: 'POST',
    url,
    remoteAddress: `10.2.0.${++ip}`,
    headers: { ...form, cookie },
    payload: new URLSearchParams(fields).toString(),
  });
}

async function login(username: string) {
  const page = await app.inject({ method: 'GET', url: '/login' });
  const res = await post(
    '/login',
    { username, password: PASSWORD, _csrf: csrfOf(page.body) },
    cookieOf(page),
  );
  expect(res.statusCode).toBe(302);
  return cookieOf(res);
}

async function accountPage(cookie: string) {
  const res = await app.inject({ method: 'GET', url: '/account', headers: { cookie } });
  expect(res.statusCode).toBe(200);
  return { res, token: csrfOf(res.body), cookie: cookieOf(res) || cookie };
}

const activeKeys = (userId: string) =>
  t.db
    .selectFrom('api_keys')
    .select('id')
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .execute();

const setLastUsed = (id: string, minutesAgo: number | null) =>
  t.db
    .updateTable('api_keys')
    .set({
      last_used_at: minutesAgo === null ? null : new Date(Date.now() - minutesAgo * 60_000),
    })
    .where('id', '=', id)
    .execute();

const lastUsed = async (id: string) =>
  (
    await t.db
      .selectFrom('api_keys')
      .select('last_used_at')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
  ).last_used_at;

describe('api keys', () => {
  beforeEach(async () => {
    await t.db.updateTable('api_keys').set({ revoked_at: new Date() }).execute();
  });

  it('creates a slk_ key that authenticates', async () => {
    const { id, key } = await createApiKey(t.db, aliceId, 'PC');
    expect(key).toMatch(/^slk_[\w-]{43}$/);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await authenticateApiKey(t.db, key)).toEqual({ userId: aliceId });
  });

  it('keeps every key valid when another one is created', async () => {
    const pc = await createApiKey(t.db, aliceId, 'PC');
    const phone = await createApiKey(t.db, aliceId, 'Phone');
    expect(await authenticateApiKey(t.db, pc.key)).toEqual({ userId: aliceId });
    expect(await authenticateApiKey(t.db, phone.key)).toEqual({ userId: aliceId });
    expect(await activeKeys(aliceId)).toHaveLength(2);
  });

  it('revokes one key and leaves the others valid', async () => {
    const pc = await createApiKey(t.db, aliceId, 'PC');
    const phone = await createApiKey(t.db, aliceId, 'Phone');
    expect(await revokeApiKey(t.db, aliceId, pc.id)).toBe(true);
    expect(await authenticateApiKey(t.db, pc.key)).toBeNull();
    expect(await authenticateApiKey(t.db, phone.key)).toEqual({ userId: aliceId });
    expect(await revokeApiKey(t.db, aliceId, pc.id)).toBe(false);
  });

  it("refuses to revoke another user's key or a malformed id", async () => {
    const bob = await createApiKey(t.db, bobId, 'PC');
    expect(await revokeApiKey(t.db, aliceId, bob.id)).toBe(false);
    expect(await authenticateApiKey(t.db, bob.key)).toEqual({ userId: bobId });
    expect(await revokeApiKey(t.db, aliceId, 'not-a-uuid')).toBe(false);
    expect(await revokeApiKey(t.db, aliceId, randomUUID())).toBe(false);
  });

  it('trims the name and rejects empty or too long names', async () => {
    const { id } = await createApiKey(t.db, aliceId, '  PC  ');
    expect((await listApiKeys(t.db, aliceId)).find((k) => k.id === id)?.name).toBe('PC');
    for (const bad of ['', '   ', 'x'.repeat(MAX_KEY_NAME_LENGTH + 1)]) {
      await expect(createApiKey(t.db, aliceId, bad)).rejects.toBeInstanceOf(ApiKeyNameError);
    }
    await expect(
      createApiKey(t.db, aliceId, 'x'.repeat(MAX_KEY_NAME_LENGTH)),
    ).resolves.toBeDefined();
  });

  it('lists active keys only, newest first, without the secret', async () => {
    const old = await createApiKey(t.db, aliceId, 'Old');
    await t.db
      .updateTable('api_keys')
      .set({ created_at: new Date(Date.now() - 86_400_000) })
      .where('id', '=', old.id)
      .execute();
    const revoked = await createApiKey(t.db, aliceId, 'Revoked');
    await revokeApiKey(t.db, aliceId, revoked.id);
    const fresh = await createApiKey(t.db, aliceId, 'Fresh');
    await createApiKey(t.db, bobId, 'Bob');
    const keys = await listApiKeys(t.db, aliceId);
    expect(keys.map((k) => k.name)).toEqual(['Fresh', 'Old']);
    expect(keys[0]).toEqual({
      id: fresh.id,
      name: 'Fresh',
      prefix: fresh.key.slice(0, 8),
      createdAt: expect.any(Date),
      lastUsedAt: null,
    });
    expect(JSON.stringify(keys)).not.toContain(fresh.key);
  });

  it('records the last use at most every 5 minutes', async () => {
    const { id, key } = await createApiKey(t.db, aliceId, 'PC');
    expect(await lastUsed(id)).toBeNull();
    await authenticateApiKey(t.db, key);
    expect(await lastUsed(id)).toBeInstanceOf(Date);

    await setLastUsed(id, 1);
    const recent = await lastUsed(id);
    await authenticateApiKey(t.db, key);
    expect(await lastUsed(id)).toEqual(recent);

    await setLastUsed(id, 6);
    const stale = await lastUsed(id);
    await authenticateApiKey(t.db, key);
    expect((await lastUsed(id))?.getTime()).toBeGreaterThan(stale?.getTime() ?? 0);
  });

  it('refuses a revoked key', async () => {
    const { id, key } = await createApiKey(t.db, aliceId, 'PC');
    await revokeApiKey(t.db, aliceId, id);
    expect(await authenticateApiKey(t.db, key)).toBeNull();
  });

  it('never stores the plaintext key', async () => {
    const { key } = await createApiKey(t.db, bobId, 'PC');
    const rows = await t.db.selectFrom('api_keys').selectAll().execute();
    expect(JSON.stringify(rows)).not.toContain(key);
    const row = rows.find((r) => r.user_id === bobId && r.revoked_at === null);
    expect(row?.key_prefix).toBe(key.slice(0, 8));
    expect(row?.key_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns null for malformed keys', async () => {
    for (const bad of [
      '',
      'slk_',
      'ogd_'.padEnd(47, 'a'),
      `slk_${'a'.repeat(42)}`,
      'x'.repeat(5000),
    ]) {
      expect(await authenticateApiKey(t.db, bad)).toBeNull();
    }
    expect(await authenticateApiKey(t.db, `slk_${'a'.repeat(43)}`)).toBeNull();
  });
});

describe('account api key routes', () => {
  it('redirects anonymous users to /login', async () => {
    const get = await app.inject({ method: 'GET', url: '/account' });
    expect(get.statusCode).toBe(302);
    for (const url of ['/account/api-key', '/account/api-key/revoke']) {
      const res = await app.inject({ method: 'POST', url, headers: form, payload: '' });
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/login');
    }
  });

  it('rejects both POSTs without a CSRF token', async () => {
    const cookie = await login('alice');
    for (const url of ['/account/api-key', '/account/api-key/revoke']) {
      const res = await post(url, {}, cookie);
      expect(res.statusCode).toBe(403);
    }
  });

  it('shows the key once with no-store, then only its prefix', async () => {
    const cookie = await login('alice');
    const before = await accountPage(cookie);
    expect(before.res.body).toContain('No active API key');

    const created = await post('/account/api-key', { _csrf: before.token }, before.cookie);
    expect(created.statusCode).toBe(200);
    expect(created.headers['cache-control']).toBe('no-store');
    const key = /slk_[\w-]{43}/.exec(created.body)?.[0] as string;
    expect(key).toBeDefined();
    expect(await authenticateApiKey(t.db, key)).toEqual({ userId: aliceId });

    const after = await accountPage(cookie);
    expect(after.res.body).not.toContain(key);
    expect(after.res.body).toContain(key.slice(0, 8));

    const revoked = await post('/account/api-key/revoke', { _csrf: after.token }, after.cookie);
    expect(revoked.statusCode).toBe(302);
    expect(revoked.headers.location).toBe('/account');
    expect(await authenticateApiKey(t.db, key)).toBeNull();
    expect((await accountPage(cookie)).res.body).toContain('No active API key');
  });

  it('renders the account page in French', async () => {
    const cookie = await login('bob');
    const { res } = await accountPage(cookie);
    expect(res.body).toContain('Aucune clé API active');
  });
});
