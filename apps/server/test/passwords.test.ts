import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CurrentPasswordError,
  changePassword,
  consumePasswordReset,
  createPasswordReset,
  getPasswordReset,
  PasswordResetError,
  setPassword,
  UnknownUserError,
} from '../src/users/passwords';
import { createUser, type User, UserInputError, verifyCredentials } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';

const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'another long password';
const PUBLIC_URL = 'https://starledger.example.org/';

let t: TestDb;
let admin: User;
let n = 0;

beforeAll(async () => {
  t = await startTestDb();
  admin = await createUser(t.db, {
    username: 'admin',
    password: PASSWORD,
    isAdmin: true,
    locale: 'en',
  });
}, 120_000);

afterAll(async () => {
  await t.teardown();
});

const newUser = () =>
  createUser(t.db, { username: `user${++n}`, password: PASSWORD, isAdmin: false, locale: 'en' });

const versionOf = async (id: string) =>
  (
    await t.db
      .selectFrom('users')
      .select('session_version')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
  ).session_version;

const tokenOf = (url: string) => url.split('/reset/')[1] as string;

describe('changePassword', () => {
  it('replaces the password and bumps the session version', async () => {
    const user = await newUser();
    expect(user.sessionVersion).toBe(0);
    const { sessionVersion } = await changePassword(t.db, user.id, PASSWORD, NEW_PASSWORD);
    expect(sessionVersion).toBe(1);
    expect(await versionOf(user.id)).toBe(1);
    expect(await verifyCredentials(t.db, user.username, PASSWORD)).toBeNull();
    expect((await verifyCredentials(t.db, user.username, NEW_PASSWORD))?.sessionVersion).toBe(1);
  });

  it('changes nothing when the current password is wrong', async () => {
    const user = await newUser();
    await expect(
      changePassword(t.db, user.id, 'wrong password!', NEW_PASSWORD),
    ).rejects.toBeInstanceOf(CurrentPasswordError);
    expect(await versionOf(user.id)).toBe(0);
    expect(await verifyCredentials(t.db, user.username, PASSWORD)).not.toBeNull();
  });

  it('rejects a new password shorter than 12 characters', async () => {
    const user = await newUser();
    await expect(changePassword(t.db, user.id, PASSWORD, 'elevenchars')).rejects.toMatchObject({
      code: 'password_short',
    });
    expect(await verifyCredentials(t.db, user.username, PASSWORD)).not.toBeNull();
  });
});

describe('setPassword', () => {
  it('sets the password without the current one and bumps the version', async () => {
    const user = await newUser();
    expect(await setPassword(t.db, user.id, NEW_PASSWORD)).toEqual({ sessionVersion: 1 });
    expect(await verifyCredentials(t.db, user.username, NEW_PASSWORD)).not.toBeNull();
    await expect(setPassword(t.db, user.id, 'short')).rejects.toBeInstanceOf(UserInputError);
  });
});

describe('password reset links', () => {
  it('creates a 24 h link for a normalized username, hashed at rest', async () => {
    const user = await newUser();
    const { url, username } = await createPasswordReset(
      t.db,
      admin.id,
      `  ${user.username.toUpperCase()} `,
      PUBLIC_URL,
    );
    expect(username).toBe(user.username);
    expect(url).toMatch(/^https:\/\/starledger\.example\.org\/reset\/[\w-]{43}$/);
    const row = await t.db
      .selectFrom('password_resets')
      .selectAll()
      .where('user_id', '=', user.id)
      .executeTakeFirstOrThrow();
    expect(JSON.stringify(row)).not.toContain(tokenOf(url));
    const hours = (row.expires_at.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24);
    expect(await getPasswordReset(t.db, tokenOf(url))).toEqual({ username: user.username });
  });

  it('refuses an unknown username', async () => {
    await expect(createPasswordReset(t.db, admin.id, 'nobody', PUBLIC_URL)).rejects.toBeInstanceOf(
      UnknownUserError,
    );
  });

  it('invalidates the previous open link of the same account', async () => {
    const user = await newUser();
    const first = await createPasswordReset(t.db, admin.id, user.username, PUBLIC_URL);
    const second = await createPasswordReset(t.db, admin.id, user.username, PUBLIC_URL);
    expect(await getPasswordReset(t.db, tokenOf(first.url))).toBeNull();
    expect(await getPasswordReset(t.db, tokenOf(second.url))).not.toBeNull();
    await expect(
      consumePasswordReset(t.db, tokenOf(first.url), NEW_PASSWORD),
    ).rejects.toBeInstanceOf(PasswordResetError);
  });

  it('keeps the old password until used, then swaps it once', async () => {
    const user = await newUser();
    const { url } = await createPasswordReset(t.db, admin.id, user.username, PUBLIC_URL);
    expect(await verifyCredentials(t.db, user.username, PASSWORD)).not.toBeNull();
    const result = await consumePasswordReset(t.db, tokenOf(url), NEW_PASSWORD);
    expect(result.user.id).toBe(user.id);
    expect(result.sessionVersion).toBe(1);
    expect(await verifyCredentials(t.db, user.username, PASSWORD)).toBeNull();
    expect(await verifyCredentials(t.db, user.username, NEW_PASSWORD)).not.toBeNull();
    expect(await getPasswordReset(t.db, tokenOf(url))).toBeNull();
    await expect(consumePasswordReset(t.db, tokenOf(url), PASSWORD)).rejects.toBeInstanceOf(
      PasswordResetError,
    );
  });

  it('lets only one of two concurrent uses succeed', async () => {
    const user = await newUser();
    const { url } = await createPasswordReset(t.db, admin.id, user.username, PUBLIC_URL);
    const results = await Promise.allSettled([
      consumePasswordReset(t.db, tokenOf(url), NEW_PASSWORD),
      consumePasswordReset(t.db, tokenOf(url), 'a third long password'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(PasswordResetError);
    expect(await versionOf(user.id)).toBe(1);
  });

  it('refuses an expired link', async () => {
    const user = await newUser();
    const { url } = await createPasswordReset(t.db, admin.id, user.username, PUBLIC_URL);
    await t.db
      .updateTable('password_resets')
      .set({ expires_at: new Date(Date.now() - 1000) })
      .where('user_id', '=', user.id)
      .execute();
    expect(await getPasswordReset(t.db, tokenOf(url))).toBeNull();
    await expect(consumePasswordReset(t.db, tokenOf(url), NEW_PASSWORD)).rejects.toBeInstanceOf(
      PasswordResetError,
    );
  });

  it('keeps the link usable after a too short password', async () => {
    const user = await newUser();
    const { url } = await createPasswordReset(t.db, admin.id, user.username, PUBLIC_URL);
    await expect(consumePasswordReset(t.db, tokenOf(url), 'short')).rejects.toBeInstanceOf(
      UserInputError,
    );
    expect(await getPasswordReset(t.db, tokenOf(url))).not.toBeNull();
    await expect(consumePasswordReset(t.db, tokenOf(url), NEW_PASSWORD)).resolves.toBeDefined();
  });

  it('treats an unknown token as invalid', async () => {
    expect(await getPasswordReset(t.db, 'nope')).toBeNull();
    await expect(consumePasswordReset(t.db, 'nope', NEW_PASSWORD)).rejects.toBeInstanceOf(
      PasswordResetError,
    );
  });
});
