import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { Kysely } from 'kysely';
import { createDb } from '../../src/db/db';
import { migrateToLatest } from '../../src/db/migrate';
import type { Database } from '../../src/db/schema';

export interface TestDb {
  db: Kysely<Database>;
  connectionString: string;
  teardown: () => Promise<void>;
}

export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer('postgres:17').start();
  const connectionString = container.getConnectionUri();
  const db = createDb(connectionString);
  await migrateToLatest(db);
  return {
    db,
    connectionString,
    teardown: async () => {
      await db.destroy();
      await container.stop();
    },
  };
}
