import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { authenticateApiKey, generateApiKey, revokeApiKey } from '../src/auth/api-keys';
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

describe('api keys', () => {
  beforeEach(async () => {
    await revokeApiKey(t.db, aliceId);
    await revokeApiKey(t.db, bobId);
  });

  it('generates a slk_ key that authenticates', async () => {
    const key = await generateApiKey(t.db, aliceId);
    expect(key).toMatch(/^slk_[\w-]{43}$/);
    expect(await authenticateApiKey(t.db, key)).toEqual({ userId: aliceId });
    await revokeApiKey(t.db, aliceId);
  });

  it('invalidates the previous key on regeneration', async () => {
    const first = await generateApiKey(t.db, aliceId);
    const second = await generateApiKey(t.db, aliceId);
    expect(await authenticateApiKey(t.db, first)).toBeNull();
    expect(await authenticateApiKey(t.db, second)).toEqual({ userId: aliceId });
    await revokeApiKey(t.db, aliceId);
  });

  it('refuses a revoked key', async () => {
    const key = await generateApiKey(t.db, aliceId);
    await revokeApiKey(t.db, aliceId);
    expect(await authenticateApiKey(t.db, key)).toBeNull();
  });

  it('never stores the plaintext key', async () => {
    const key = await generateApiKey(t.db, bobId);
    const rows = await t.db.selectFrom('api_keys').selectAll().execute();
    expect(JSON.stringify(rows)).not.toContain(key);
    const row = rows.find((r) => r.user_id === bobId && r.revoked_at === null);
    expect(row?.key_prefix).toBe(key.slice(0, 8));
    expect(row?.key_hash).toMatch(/^[0-9a-f]{64}$/);
    await revokeApiKey(t.db, bobId);
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

  it('serializes concurrent regenerations', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked = () => {};
    const holding = new Promise<void>((resolve) => {
      locked = resolve;
    });
    // Mimics a first regeneration paused between its revoke and its insert.
    const first = t.db.transaction().execute(async (trx) => {
      await trx.selectFrom('users').select('id').where('id', '=', aliceId).forUpdate().execute();
      await trx
        .updateTable('api_keys')
        .set({ revoked_at: new Date() })
        .where('user_id', '=', aliceId)
        .where('revoked_at', 'is', null)
        .execute();
      locked();
      await gate;
      await trx
        .insertInto('api_keys')
        .values({
          id: randomUUID(),
          user_id: aliceId,
          key_hash: 'f'.repeat(64),
          key_prefix: 'slk_ffff',
        })
        .execute();
    });
    await holding;

    let settled = false;
    const second = generateApiKey(t.db, aliceId).finally(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(settled).toBe(false);

    release();
    await first;
    const key = await second;
    expect(await authenticateApiKey(t.db, key)).toEqual({ userId: aliceId });
    const active = await t.db
      .selectFrom('api_keys')
      .select('id')
      .where('user_id', '=', aliceId)
      .where('revoked_at', 'is', null)
      .execute();
    expect(active).toHaveLength(1);
  });

  it('keeps another user key valid across regeneration and revocation', async () => {
    const bobKey = await generateApiKey(t.db, bobId);
    await generateApiKey(t.db, aliceId);
    await revokeApiKey(t.db, aliceId);
    expect(await authenticateApiKey(t.db, bobKey)).toEqual({ userId: bobId });
  });

  it('revoking without an active key is a no-op', async () => {
    await expect(revokeApiKey(t.db, aliceId)).resolves.toBeUndefined();
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
