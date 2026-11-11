import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

const KEY_PREFIX = 'slk_';
const KEY_PATTERN = /^slk_[A-Za-z0-9_-]{43}$/;
const DISPLAY_PREFIX_LENGTH = 8;

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export async function generateApiKey(db: Kysely<Database>, userId: string): Promise<string> {
  const key = KEY_PREFIX + randomBytes(32).toString('base64url');
  // One transaction: the partial unique index allows a single active key per user.
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('api_keys')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
    await trx
      .insertInto('api_keys')
      .values({
        id: randomUUID(),
        user_id: userId,
        key_hash: hashKey(key),
        key_prefix: key.slice(0, DISPLAY_PREFIX_LENGTH),
      })
      .execute();
  });
  return key;
}

export async function revokeApiKey(db: Kysely<Database>, userId: string): Promise<void> {
  await db
    .updateTable('api_keys')
    .set({ revoked_at: new Date() })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .execute();
}

export async function getActiveApiKey(
  db: Kysely<Database>,
  userId: string,
): Promise<{ prefix: string; createdAt: Date } | null> {
  const row = await db
    .selectFrom('api_keys')
    .select(['key_prefix', 'created_at'])
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  return row ? { prefix: row.key_prefix, createdAt: row.created_at } : null;
}

export async function authenticateApiKey(
  db: Kysely<Database>,
  key: string,
): Promise<{ userId: string } | null> {
  if (!KEY_PATTERN.test(key)) return null;
  const row = await db
    .selectFrom('api_keys')
    .select('user_id')
    .where('key_hash', '=', hashKey(key))
    .where('revoked_at', 'is', null)
    .executeTakeFirst();
  return row ? { userId: row.user_id } : null;
}
