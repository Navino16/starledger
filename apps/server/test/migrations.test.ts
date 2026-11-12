import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb, type TestDb } from './helpers/db';

const TABLES = [
  'accounts',
  'api_keys',
  'devices',
  'events',
  'invitations',
  'observations',
  'universe_settings',
  'users',
];

let t: TestDb;

beforeAll(async () => {
  t = await startTestDb();
});
afterAll(async () => {
  await t.teardown();
});

describe('migration 0002', () => {
  it('adds universe_settings.anomaly_ship_ratio defaulting to 100', async () => {
    const userId = randomUUID();
    await t.db
      .insertInto('users')
      .values({ id: userId, username: 'carol', password_hash: 'h' })
      .execute();
    await t.db
      .insertInto('universe_settings')
      .values({ user_id: userId, server_id: 1, lang: 'en' })
      .execute();
    const row = await t.db
      .selectFrom('universe_settings')
      .select('anomaly_ship_ratio')
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();
    expect(row.anomaly_ship_ratio).toBe(100);
  });

  it('drops the column on down', async () => {
    const { up, down } = await import('../src/db/migrations/0002_anomaly_ship_ratio');
    await down(t.db);
    const cols = async () =>
      (await t.db.introspection.getTables())
        .find((x) => x.name === 'universe_settings')
        ?.columns.map((c) => c.name);
    expect(await cols()).not.toContain('anomaly_ship_ratio');
    await up(t.db);
    expect(await cols()).toContain('anomaly_ship_ratio');
  });
});

describe('migration 0001', () => {
  it('creates the 8 tables', async () => {
    const rows = await t.db.introspection.getTables();
    const names = rows.map((r) => r.name).filter((n) => TABLES.includes(n));
    expect(names.sort()).toEqual(TABLES);
  });

  it('is idempotent when run again', async () => {
    const { migrateToLatest } = await import('../src/db/migrate');
    await expect(migrateToLatest(t.db)).resolves.toBeUndefined();
  });

  it('rejects a second active API key for the same user', async () => {
    const userId = randomUUID();
    await t.db
      .insertInto('users')
      .values({ id: userId, username: 'alice', password_hash: 'h' })
      .execute();
    await t.db
      .insertInto('api_keys')
      .values({ id: randomUUID(), user_id: userId, key_hash: 'k1', key_prefix: 'p1' })
      .execute();
    await expect(
      t.db
        .insertInto('api_keys')
        .values({ id: randomUUID(), user_id: userId, key_hash: 'k2', key_prefix: 'p2' })
        .execute(),
    ).rejects.toMatchObject({ code: '23505' });
    await t.db
      .updateTable('api_keys')
      .set({ revoked_at: sql`now()` })
      .where('user_id', '=', userId)
      .execute();
    await t.db
      .insertInto('api_keys')
      .values({ id: randomUUID(), user_id: userId, key_hash: 'k3', key_prefix: 'p3' })
      .execute();
  });
});
