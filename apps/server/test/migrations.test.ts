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
});

describe('migration 0003', () => {
  it('keeps a key created before it, unnamed and never used', async () => {
    const userId = randomUUID();
    await t.db
      .insertInto('users')
      .values({ id: userId, username: 'dave', password_hash: 'h' })
      .execute();
    const { up, down } = await import('../src/db/migrations/0003_api_key_names');
    await down(t.db);
    await sql`insert into api_keys (id, user_id, key_hash, key_prefix) values (${randomUUID()}, ${userId}, 'k0', 'p0')`.execute(
      t.db,
    );
    await up(t.db);
    const row = await t.db
      .selectFrom('api_keys')
      .select(['name', 'last_used_at', 'revoked_at'])
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ name: null, last_used_at: null, revoked_at: null });
  });

  it('allows several active keys per user, and down keeps only the newest', async () => {
    const userId = randomUUID();
    await t.db
      .insertInto('users')
      .values({ id: userId, username: 'erin', password_hash: 'h' })
      .execute();
    for (const [hash, age] of [
      ['k1', 2],
      ['k2', 1],
    ] as const) {
      await t.db
        .insertInto('api_keys')
        .values({
          id: randomUUID(),
          user_id: userId,
          key_hash: hash,
          key_prefix: hash,
          created_at: new Date(Date.now() - age * 60_000),
        })
        .execute();
    }
    const { up, down } = await import('../src/db/migrations/0003_api_key_names');
    await down(t.db);
    const active = await sql<{
      key_hash: string;
    }>`select key_hash from api_keys where user_id = ${userId} and revoked_at is null`.execute(
      t.db,
    );
    expect(active.rows.map((r) => r.key_hash)).toEqual(['k2']);
    await up(t.db);
  });
});
