import { randomUUID } from 'node:crypto';
import { type Kysely, sql } from 'kysely';
import { hashToken, newToken } from '../auth/tokens';
import type { Database } from '../db/schema';
import { createUser, type User } from './users';

export class InvitationError extends Error {
  constructor() {
    super('Invitation is unknown, expired or already used');
  }
}

export async function createInvitation(
  db: Kysely<Database>,
  adminId: string,
  publicUrl: string,
  ttlHours = 72,
): Promise<{ url: string }> {
  const { token, hash } = newToken();
  await db
    .insertInto('invitations')
    .values({
      id: randomUUID(),
      token_hash: hash,
      created_by: adminId,
      expires_at: new Date(Date.now() + ttlHours * 3_600_000),
    })
    .execute();
  return { url: `${publicUrl.replace(/\/+$/, '')}/invite/${token}` };
}

export async function isInvitationUsable(db: Kysely<Database>, token: string): Promise<boolean> {
  const row = await db
    .selectFrom('invitations')
    .select('id')
    .where('token_hash', '=', hashToken(token))
    .where('used_at', 'is', null)
    .where('expires_at', '>', sql<Date>`now()`)
    .executeTakeFirst();
  return row !== undefined;
}

export async function consumeInvitation(
  db: Kysely<Database>,
  token: string,
  input: { username: string; password: string; locale?: 'fr' | 'en' },
): Promise<User> {
  return db.transaction().execute(async (trx) => {
    // The conditional update locks the row, so a concurrent use waits and then matches nothing.
    const claimed = await trx
      .updateTable('invitations')
      .set({ used_at: sql<Date>`now()` })
      .where('token_hash', '=', hashToken(token))
      .where('used_at', 'is', null)
      .where('expires_at', '>', sql<Date>`now()`)
      .returning('id')
      .executeTakeFirst();
    if (!claimed) throw new InvitationError();
    const user = await createUser(trx, {
      username: input.username,
      password: input.password,
      isAdmin: false,
      locale: input.locale ?? 'en',
    });
    await trx
      .updateTable('invitations')
      .set({ used_by: user.id })
      .where('id', '=', claimed.id)
      .execute();
    return user;
  });
}
