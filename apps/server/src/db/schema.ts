import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;
type Int8 = ColumnType<string, string | number | bigint, string | number | bigint>;
type Numeric = ColumnType<string, string | number | undefined, string | number>;

export interface UsersTable {
  id: string;
  username: string;
  password_hash: string;
  is_admin: Generated<boolean>;
  locale: Generated<'fr' | 'en'>;
  created_at: Generated<Timestamp>;
}

export interface InvitationsTable {
  id: string;
  token_hash: string;
  created_by: string;
  expires_at: Timestamp;
  used_at: NullableTimestamp;
  used_by: string | null;
  created_at: Generated<Timestamp>;
}

export interface ApiKeysTable {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  revoked_at: NullableTimestamp;
  created_at: Generated<Timestamp>;
}

export interface AccountsTable {
  id: Generated<string>;
  user_id: string;
  server_id: number;
  lang: string;
  player_id: Int8;
  player_name: string | null;
  created_at: Generated<Timestamp>;
}

export interface DevicesTable {
  user_id: string;
  device_id: string;
  client_version: string;
  first_seen: Timestamp;
  last_seen: Timestamp;
  created_at: Generated<Timestamp>;
}

export interface ObservationsTable {
  id: Generated<string>;
  user_id: string;
  account_id: Int8;
  device_id: string;
  client_observation_id: string;
  kind: string;
  external_key: string;
  payload: ColumnType<unknown, string, string>;
  observed_at: Timestamp;
  received_at: Generated<Timestamp>;
  created_at: Generated<Timestamp>;
}

export interface EventsTable {
  id: Generated<string>;
  account_id: Int8;
  external_key: string;
  kind: string | null;
  status: 'ok' | 'unrecognized' | 'conflict';
  occurred_at: NullableTimestamp;
  day: ColumnType<string | null, string | null | undefined, string | null>;
  data: ColumnType<unknown, string | null | undefined, string | null>;
  parser_version: number;
  first_observation_id: Int8;
  created_at: Generated<Timestamp>;
}

export interface UniverseSettingsTable {
  user_id: string;
  server_id: number;
  lang: string;
  msu_metal: Generated<Numeric>;
  msu_crystal: Generated<Numeric>;
  msu_deuterium: Generated<Numeric>;
  expedition_ship_ratio: Generated<number>;
  ignore_expe_ships_loss: Generated<boolean>;
  ignore_consumption: Generated<boolean>;
  include_trades_in_balance: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

export interface Database {
  users: UsersTable;
  invitations: InvitationsTable;
  api_keys: ApiKeysTable;
  accounts: AccountsTable;
  devices: DevicesTable;
  observations: ObservationsTable;
  events: EventsTable;
  universe_settings: UniverseSettingsTable;
}
