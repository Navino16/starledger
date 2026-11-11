import { randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

export const MIN_PASSWORD_LENGTH = 12;

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  locale: 'fr' | 'en';
}

export interface NewUser {
  username: string;
  password: string;
  isAdmin: boolean;
  locale: 'fr' | 'en';
}

type UserRow = { id: string; username: string; is_admin: boolean; locale: 'fr' | 'en' };

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  isAdmin: row.is_admin,
  locale: row.locale,
});

const normalize = (username: string) => username.trim().toLowerCase();

export type UserInputErrorCode = 'username_invalid' | 'password_short' | 'username_taken';

export class UserInputError extends Error {
  constructor(
    readonly code: UserInputErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/;

const PG_UNIQUE_VIOLATION = '23505';

export async function createUser(db: Kysely<Database>, input: NewUser): Promise<User> {
  const username = normalize(input.username);
  if (!USERNAME_PATTERN.test(username)) {
    throw new UserInputError(
      'username_invalid',
      'Username must be 3 to 32 characters among a-z, 0-9, "_", "." and "-"',
    );
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new UserInputError(
      'password_short',
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  const passwordHash = await hash(input.password);
  try {
    const row = await db
      .insertInto('users')
      .values({
        id: randomUUID(),
        username,
        password_hash: passwordHash,
        is_admin: input.isAdmin,
        locale: input.locale,
      })
      .returning(['id', 'username', 'is_admin', 'locale'])
      .executeTakeFirstOrThrow();
    return toUser(row);
  } catch (error) {
    if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      throw new UserInputError('username_taken', `Username "${username}" is already taken`);
    }
    throw error;
  }
}

// Hash of a throwaway password, verified when the user is missing to even out response time.
const DUMMY_HASH_PROMISE = hash('starledger-dummy-password');

export async function verifyCredentials(
  db: Kysely<Database>,
  username: string,
  password: string,
): Promise<User | null> {
  const row = await db
    .selectFrom('users')
    .select(['id', 'username', 'is_admin', 'locale', 'password_hash'])
    .where('username', '=', normalize(username))
    .executeTakeFirst();
  const valid = await verify(row?.password_hash ?? (await DUMMY_HASH_PROMISE), password);
  return row && valid ? toUser(row) : null;
}
