import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { type Kysely, sql } from 'kysely';
import type { Database } from '../db/schema';

const KEY_PREFIX = 'slk_';
const KEY_PATTERN = /^slk_[A-Za-z0-9_-]{43}$/;
const DISPLAY_PREFIX_LENGTH = 8;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_KEY_NAME_LENGTH = 64;

export class ApiKeyNameError extends Error {
  constructor() {
    super(`API key name must be 1 to ${MAX_KEY_NAME_LENGTH} characters`);
  }
}

export interface ApiKeySummary {
  id: string;
  name: string | null;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export async function createApiKey(
  db: Kysely<Database>,
  userId: string,
  name: string,
): Promise<{ id: string; key: string }> {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_KEY_NAME_LENGTH) throw new ApiKeyNameError();
  const id = randomUUID();
  const key = KEY_PREFIX + randomBytes(32).toString('base64url');
  await db
    .insertInto('api_keys')
    .values({
      id,
      user_id: userId,
      key_hash: hashKey(key),
      key_prefix: key.slice(0, DISPLAY_PREFIX_LENGTH),
      name: trimmed,
    })
    .execute();
  return { id, key };
}

export async function listApiKeys(db: Kysely<Database>, userId: string): Promise<ApiKeySummary[]> {
  const rows = await db
    .selectFrom('api_keys')
    .select(['id', 'name', 'key_prefix', 'created_at', 'last_used_at'])
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .orderBy('created_at', 'desc')
    .execute();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

export async function revokeApiKey(
  db: Kysely<Database>,
  userId: string,
  keyId: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(keyId)) return false;
  const result = await db
    .updateTable('api_keys')
    .set({ revoked_at: new Date() })
    .where('id', '=', keyId)
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

export async function authenticateApiKey(
  db: Kysely<Database>,
  key: string,
): Promise<{ userId: string } | null> {
  if (!KEY_PATTERN.test(key)) return null;
  const row = await db
    .selectFrom('api_keys')
    .select(['id', 'user_id'])
    .where('key_hash', '=', hashKey(key))
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  if (!row) return null;
  // Throttled so each userscript batch does not rewrite the row (spec web-front, "Clés API").
  await db
    .updateTable('api_keys')
    .set({ last_used_at: sql<Date>`now()` })
    .where('id', '=', row.id)
    .where((eb) =>
      eb.or([
        eb('last_used_at', 'is', null),
        eb('last_used_at', '<', sql<Date>`now() - interval '5 minutes'`),
      ]),
    )
    .execute();
  return { userId: row.user_id };
}
