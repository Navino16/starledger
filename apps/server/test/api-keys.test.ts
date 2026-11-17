import { randomUUID } from 'node:crypto';
import { MAX_KEY_NAME_LENGTH } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import {
  ApiKeyNameError,
  authenticateApiKey,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../src/auth/api-keys';
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

describe('GET /api/site/api-keys', () => {
  it('lists an unnamed, never used key with null fields', async () => {
    const id = randomUUID();
    await t.db
      .insertInto('api_keys')
      .values({ id, user_id: bobId, key_hash: 'b'.repeat(64), key_prefix: 'slk_bbbb' })
      .execute();
    const client = siteClient(app);
    await client.login('bob', PASSWORD);
    const res = await client.call('GET', '/api-keys');
    expect(res.json().keys).toContainEqual({
      id,
      name: null,
      prefix: 'slk_bbbb',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      lastUsedAt: null,
    });
  });
});
