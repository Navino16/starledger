import { type Kysely, sql } from 'kysely';

// spec web-front, "Clés API": any number of named keys per user
// biome-ignore lint/suspicious/noExplicitAny: Kysely migrations are schema-agnostic
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('api_keys_one_active_per_user').execute();
  await db.schema
    .alterTable('api_keys')
    .addColumn('name', 'text')
    .addColumn('last_used_at', 'timestamptz')
    .execute();
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migrations are schema-agnostic
export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    update api_keys set revoked_at = now()
    where revoked_at is null
      and id not in (
        select distinct on (user_id) id from api_keys
        where revoked_at is null
        order by user_id, created_at desc
      )
  `.execute(db);
  await db.schema.alterTable('api_keys').dropColumn('name').dropColumn('last_used_at').execute();
  await db.schema
    .createIndex('api_keys_one_active_per_user')
    .on('api_keys')
    .column('user_id')
    .unique()
    .where(sql.ref('revoked_at'), 'is', null)
    .execute();
}
