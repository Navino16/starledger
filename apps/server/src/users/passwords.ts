import { randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { type Kysely, sql } from 'kysely';
import { hashToken, newToken } from '../auth/tokens';
import type { Database } from '../db/schema';
import { assertPasswordLength, normalizeUsername, toUser, type User } from './users';

export class CurrentPasswordError extends Error {
  constructor() {
    super('Current password is incorrect');
  }
}

export class PasswordResetError extends Error {
  constructor() {
    super('Password reset link is unknown, expired or already used');
  }
}

export class UnknownUserError extends Error {
  constructor(username: string) {
    super(`Unknown user "${username}"`);
  }
}

// Bumping session_version signs out every other session (spec web-front, "Mots de passe").
export async function setPassword(
  db: Kysely<Database>,
  userId: string,
  next: string,
): Promise<{ sessionVersion: number }> {
  assertPasswordLength(next);
  const row = await db
    .updateTable('users')
    .set({
      password_hash: await hash(next),
      session_version: sql<number>`session_version + 1`,
    })
    .where('id', '=', userId)
    .returning('session_version')
    .executeTakeFirstOrThrow();
  return { sessionVersion: row.session_version };
}

export async function changePassword(
  db: Kysely<Database>,
  userId: string,
  current: string,
  next: string,
): Promise<{ sessionVersion: number }> {
  const row = await db
    .selectFrom('users')
    .select('password_hash')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();
  if (!(await verify(row.password_hash, current))) throw new CurrentPasswordError();
  return setPassword(db, userId, next);
}

export async function createPasswordReset(
  db: Kysely<Database>,
  adminId: string,
  username: string,
  publicUrl: string,
  ttlHours = 24,
): Promise<{ url: string; username: string }> {
  const user = await db
    .selectFrom('users')
    .select(['id', 'username'])
    .where('username', '=', normalizeUsername(username))
    .executeTakeFirst();
  if (!user) throw new UnknownUserError(username.trim());
  const { token, hash: tokenHash } = newToken();
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('password_resets')
      .set({ expires_at: sql<Date>`now()` })
      .where('user_id', '=', user.id)
      .where('used_at', 'is', null)
      .where('expires_at', '>', sql<Date>`now()`)
      .execute();
    await trx
      .insertInto('password_resets')
      .values({
        id: randomUUID(),
        user_id: user.id,
        token_hash: tokenHash,
        created_by: adminId,
        expires_at: new Date(Date.now() + ttlHours * 3_600_000),
      })
      .execute();
  });
  return { url: `${publicUrl.replace(/\/+$/, '')}/reset/${token}`, username: user.username };
}

export async function getPasswordReset(
  db: Kysely<Database>,
  token: string,
): Promise<{ username: string } | null> {
  const row = await db
    .selectFrom('password_resets')
    .innerJoin('users', 'users.id', 'password_resets.user_id')
    .select('users.username')
    .where('password_resets.token_hash', '=', hashToken(token))
    .where('password_resets.used_at', 'is', null)
    .where('password_resets.expires_at', '>', sql<Date>`now()`)
    .executeTakeFirst();
  return row ? { username: row.username } : null;
}

export async function consumePasswordReset(
  db: Kysely<Database>,
  token: string,
  password: string,
): Promise<{ user: User; sessionVersion: number }> {
  assertPasswordLength(password);
  return db.transaction().execute(async (trx) => {
    // The conditional update locks the row, so a concurrent use waits and then matches nothing.
    const claimed = await trx
      .updateTable('password_resets')
      .set({ used_at: sql<Date>`now()` })
      .where('token_hash', '=', hashToken(token))
      .where('used_at', 'is', null)
      .where('expires_at', '>', sql<Date>`now()`)
      .returning('user_id')
      .executeTakeFirst();
    if (!claimed) throw new PasswordResetError();
    const { sessionVersion } = await setPassword(trx, claimed.user_id, password);
    const row = await trx
      .selectFrom('users')
      .select(['id', 'username', 'is_admin', 'locale', 'session_version'])
      .where('id', '=', claimed.user_id)
      .executeTakeFirstOrThrow();
    return { user: toUser(row), sessionVersion };
  });
}
