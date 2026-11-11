import { Readable, Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli';
import { createUser, verifyCredentials } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';

let t: TestDb;

beforeAll(async () => {
  t = await startTestDb();
}, 120_000);

afterAll(async () => {
  await t.teardown();
});

const PASSWORD = 'correct horse battery';

describe('users', () => {
  it('creates a user then verifies credentials', async () => {
    const user = await createUser(t.db, {
      username: 'Bob1',
      password: PASSWORD,
      isAdmin: false,
      locale: 'en',
    });
    expect(user.username).toBe('bob1');
    expect(user).not.toHaveProperty('password_hash');
    const ok = await verifyCredentials(t.db, 'BOB1', PASSWORD);
    expect(ok?.id).toBe(user.id);
  });

  it('returns null for a wrong password or unknown user', async () => {
    await createUser(t.db, { username: 'bob2', password: PASSWORD, isAdmin: false, locale: 'fr' });
    expect(await verifyCredentials(t.db, 'bob2', 'wrong password!!')).toBeNull();
    expect(await verifyCredentials(t.db, 'nobody', PASSWORD)).toBeNull();
  });

  it('rejects duplicates case-insensitively', async () => {
    await createUser(t.db, { username: 'alice', password: PASSWORD, isAdmin: false, locale: 'fr' });
    await expect(
      createUser(t.db, { username: 'Alice', password: PASSWORD, isAdmin: false, locale: 'fr' }),
    ).rejects.toThrow(/already/i);
  });

  it('rejects passwords shorter than 12 characters', async () => {
    await expect(
      createUser(t.db, { username: 'short', password: 'short', isAdmin: false, locale: 'fr' }),
    ).rejects.toThrow(/12/);
  });

  it('stores an argon2id hash', async () => {
    await createUser(t.db, { username: 'bob3', password: PASSWORD, isAdmin: false, locale: 'fr' });
    const row = await t.db
      .selectFrom('users')
      .select('password_hash')
      .where('username', '=', 'bob3')
      .executeTakeFirstOrThrow();
    expect(row.password_hash.startsWith('$argon2id$')).toBe(true);
  });
});

function sink() {
  let text = '';
  const stream = new Writable({
    write(chunk, _enc, cb) {
      text += chunk.toString();
      cb();
    },
  });
  return { stream, text: () => text };
}

describe('runCli create-admin', () => {
  it('creates an admin from a password on stdin', async () => {
    const out = sink();
    const err = sink();
    const code = await runCli(['create-admin', '--username', 'Root'], {
      stdin: Readable.from([`${PASSWORD}\n`]),
      stdout: out.stream,
      stderr: err.stream,
      db: t.db,
    });
    expect(code).toBe(0);
    expect(out.text()).not.toContain(PASSWORD);
    const user = await verifyCredentials(t.db, 'root', PASSWORD);
    expect(user?.isAdmin).toBe(true);
  });

  it('fails on duplicate username and short password', async () => {
    await createUser(t.db, { username: 'root2', password: PASSWORD, isAdmin: true, locale: 'en' });
    const run = (pw: string) => {
      const err = sink();
      return runCli(['create-admin', '--username', 'root2'], {
        stdin: Readable.from([`${pw}\n`]),
        stdout: sink().stream,
        stderr: err.stream,
        db: t.db,
      }).then((code) => ({ code, err: err.text() }));
    };
    const dup = await run(PASSWORD);
    expect(dup.code).toBe(1);
    expect(dup.err).toMatch(/already/i);
    const short = await run('tiny');
    expect(short.code).toBe(1);
    expect(short.err).not.toContain('tiny');
  });

  it('applies migrations through the migrate command', async () => {
    const out = sink();
    const code = await runCli(['migrate'], {
      stdin: Readable.from([]),
      stdout: out.stream,
      stderr: sink().stream,
      db: t.db,
    });
    expect(code).toBe(0);
    expect(out.text()).toMatch(/migrations applied/i);
  });

  it('prints usage and fails for unknown commands', async () => {
    const err = sink();
    const code = await runCli([], {
      stdin: Readable.from([]),
      stdout: sink().stream,
      stderr: err.stream,
      db: t.db,
    });
    expect(code).toBe(2);
    expect(err.text()).toMatch(/usage/i);
  });

  it.each([
    [['create-admin']],
    [['create-admin', '--bogus', 'x']],
    [['create-admin', '--username']],
  ])('returns usage error 2 for bad arguments %j', async (argv) => {
    const err = sink();
    const code = await runCli(argv, {
      stdin: Readable.from([`${PASSWORD}\n`]),
      stdout: sink().stream,
      stderr: err.stream,
      db: t.db,
    });
    expect(code).toBe(2);
    expect(err.text()).toMatch(/usage/i);
  });

  it('rejects oversized password input', async () => {
    const err = sink();
    const code = await runCli(['create-admin', '--username', 'big'], {
      stdin: Readable.from(['x'.repeat(2048)]),
      stdout: sink().stream,
      stderr: err.stream,
      db: t.db,
    });
    expect(code).toBe(1);
    expect(err.text()).toMatch(/too long/i);
  });
});
