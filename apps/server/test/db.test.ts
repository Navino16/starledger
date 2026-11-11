import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb, type TestDb } from './helpers/db';

let t: TestDb;
const originalTz = process.env.TZ;

beforeAll(async () => {
  process.env.TZ = 'Pacific/Kiritimati';
  t = await startTestDb();
}, 120_000);

afterAll(async () => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
  await t.teardown();
});

describe('createDb', () => {
  it('returns date columns as raw YYYY-MM-DD strings in a non-UTC process', async () => {
    const { rows } = await sql<{ day: string }>`select '2026-11-11'::date as day`.execute(t.db);
    expect(rows[0]?.day).toBe('2026-11-11');
  });
});
