import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './schema';

// Keep `date` columns as raw YYYY-MM-DD strings; pg would build a local-midnight Date and shift the day.
const pgTypes = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
    oid === pg.types.builtins.DATE
      ? (value: string) => value
      : pg.types.getTypeParser(oid, format)) as typeof pg.types.getTypeParser,
};

export function createDb(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString, connectionTimeoutMillis: 5000, types: pgTypes }),
    }),
  });
}
