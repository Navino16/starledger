import type { Kysely } from 'kysely';
import { type Migration, type MigrationProvider, Migrator } from 'kysely/migration';
import * as init from './migrations/0001_init';

// In-code provider: the server is bundled, so migration files do not exist at runtime.
const migrations: Record<string, Migration> = {
  '0001_init': init,
};

const provider: MigrationProvider = {
  getMigrations: async () => migrations,
};

// biome-ignore lint/suspicious/noExplicitAny: Kysely migrations are schema-agnostic
export async function migrateToLatest(db: Kysely<any>): Promise<void> {
  const { error } = await new Migrator({ db, provider }).migrateToLatest();
  if (error) throw error;
}
