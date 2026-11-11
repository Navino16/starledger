import { type Kysely, sql } from 'kysely';

// design §6.3
// biome-ignore lint/suspicious/noExplicitAny: Kysely migrations are schema-agnostic
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('username', 'text', (c) => c.notNull().unique())
    .addColumn('password_hash', 'text', (c) => c.notNull())
    .addColumn('is_admin', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('locale', 'text', (c) =>
      c.notNull().defaultTo('en').check(sql`locale in ('fr', 'en')`),
    )
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('invitations')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('created_by', 'uuid', (c) => c.notNull().references('users.id'))
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('used_at', 'timestamptz')
    .addColumn('used_by', 'uuid', (c) => c.references('users.id'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('api_keys')
    .addColumn('id', 'uuid', (c) => c.primaryKey())
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id'))
    .addColumn('key_hash', 'text', (c) => c.notNull().unique())
    .addColumn('key_prefix', 'text', (c) => c.notNull())
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex('api_keys_one_active_per_user')
    .on('api_keys')
    .column('user_id')
    .unique()
    .where(sql.ref('revoked_at'), 'is', null)
    .execute();

  await db.schema
    .createTable('accounts')
    .addColumn('id', 'bigserial', (c) => c.primaryKey())
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id'))
    .addColumn('server_id', 'integer', (c) => c.notNull())
    .addColumn('lang', 'text', (c) => c.notNull())
    .addColumn('player_id', 'bigint', (c) => c.notNull())
    .addColumn('player_name', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('accounts_user_server_lang_player_key', [
      'user_id',
      'server_id',
      'lang',
      'player_id',
    ])
    .execute();

  await db.schema
    .createTable('devices')
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id'))
    .addColumn('device_id', 'uuid', (c) => c.notNull())
    .addColumn('client_version', 'text', (c) => c.notNull())
    .addColumn('first_seen', 'timestamptz', (c) => c.notNull())
    .addColumn('last_seen', 'timestamptz', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('devices_pkey', ['user_id', 'device_id'])
    .execute();

  await db.schema
    .createTable('observations')
    .addColumn('id', 'bigserial', (c) => c.primaryKey())
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id'))
    .addColumn('account_id', 'bigint', (c) => c.notNull().references('accounts.id'))
    .addColumn('device_id', 'uuid', (c) => c.notNull())
    .addColumn('client_observation_id', 'uuid', (c) => c.notNull())
    .addColumn('kind', 'text', (c) => c.notNull())
    .addColumn('external_key', 'text', (c) => c.notNull())
    .addColumn('payload', 'jsonb', (c) => c.notNull())
    .addColumn('observed_at', 'timestamptz', (c) => c.notNull())
    .addColumn('received_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('observations_user_client_observation_key', [
      'user_id',
      'client_observation_id',
    ])
    .execute();

  await db.schema
    .createTable('events')
    .addColumn('id', 'bigserial', (c) => c.primaryKey())
    .addColumn('account_id', 'bigint', (c) => c.notNull().references('accounts.id'))
    .addColumn('external_key', 'text', (c) => c.notNull())
    .addColumn('kind', 'text')
    .addColumn('status', 'text', (c) =>
      c.notNull().check(sql`status in ('ok', 'unrecognized', 'conflict')`),
    )
    .addColumn('occurred_at', 'timestamptz')
    .addColumn('day', 'date')
    .addColumn('data', 'jsonb')
    .addColumn('parser_version', 'integer', (c) => c.notNull())
    .addColumn('first_observation_id', 'bigint', (c) => c.notNull().references('observations.id'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('events_account_external_key_key', ['account_id', 'external_key'])
    .execute();
  await db.schema
    .createIndex('events_account_day_idx')
    .on('events')
    .columns(['account_id', 'day'])
    .execute();

  await db.schema
    .createTable('universe_settings')
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id'))
    .addColumn('server_id', 'integer', (c) => c.notNull())
    .addColumn('lang', 'text', (c) => c.notNull())
    .addColumn('msu_metal', 'numeric', (c) => c.notNull().defaultTo(3))
    .addColumn('msu_crystal', 'numeric', (c) => c.notNull().defaultTo(2))
    .addColumn('msu_deuterium', 'numeric', (c) => c.notNull().defaultTo(1))
    .addColumn('expedition_ship_ratio', 'integer', (c) => c.notNull().defaultTo(100))
    .addColumn('ignore_expe_ships_loss', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('ignore_consumption', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('include_trades_in_balance', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('universe_settings_pkey', ['user_id', 'server_id', 'lang'])
    .execute();
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migrations are schema-agnostic
export async function down(db: Kysely<any>): Promise<void> {
  for (const table of [
    'universe_settings',
    'events',
    'observations',
    'devices',
    'accounts',
    'api_keys',
    'invitations',
    'users',
  ]) {
    await db.schema.dropTable(table).execute();
  }
}
