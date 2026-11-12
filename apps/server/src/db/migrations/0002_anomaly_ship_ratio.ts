import type { Kysely } from 'kysely';

// biome-ignore lint/suspicious/noExplicitAny: Kysely migrations are schema-agnostic
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('universe_settings')
    .addColumn('anomaly_ship_ratio', 'integer', (c) => c.notNull().defaultTo(100))
    .execute();
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migrations are schema-agnostic
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('universe_settings').dropColumn('anomaly_ship_ratio').execute();
}
