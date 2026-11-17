import { type Kysely, sql } from 'kysely';

// spec web-front, "Mots de passe"
// biome-ignore lint/suspicious/noExplicitAny: Kysely migrations are schema-agnostic
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('session_version', 'integer', (c) => c.notNull().defaultTo(0))
    .execute();
  await db.schema
    .createTable('password_resets')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id'))
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('created_by', 'uuid', (c) => c.notNull().references('users.id'))
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('used_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migrations are schema-agnostic
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('password_resets').execute();
  await db.schema.alterTable('users').dropColumn('session_version').execute();
}
