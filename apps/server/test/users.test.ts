import { PassThrough, Readable, Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

describe('username validation', () => {
  it.each(['ab', 'a'.repeat(33), 'with space', 'bad!', 'é-accent', ''])(
    'rejects %j',
    async (username) => {
      await expect(
        createUser(t.db, { username, password: PASSWORD, isAdmin: false, locale: 'en' }),
      ).rejects.toThrow(/3 to 32/);
    },
  );

  it('accepts 3 and 32 characters of [a-z0-9_.-] after lowercasing', async () => {
    for (const username of ['A_b', `${'Z'.repeat(31)}.`, 'a.b-c_9']) {
      await expect(
        createUser(t.db, { username, password: PASSWORD, isAdmin: false, locale: 'en' }),
      ).resolves.toMatchObject({ username: username.toLowerCase() });
    }
  });
});

describe('runCli create-admin with a TTY', () => {
  function fakeTty(input: string) {
    const stdin = Object.assign(new PassThrough(), { isTTY: true, setRawMode: vi.fn() });
    stdin.end(input);
    return stdin;
  }

  async function run(username: string, input: string) {
    const stdin = fakeTty(input);
    const out = sink();
    const err = sink();
    const code = await runCli(['create-admin', '--username', username], {
      stdin,
      stdout: out.stream,
      stderr: err.stream,
      db: t.db,
    });
    return { code, stdin, out: out.text(), err: err.text() };
  }

  const rawModes = (stdin: { setRawMode: ReturnType<typeof vi.fn> }) =>
    stdin.setRawMode.mock.calls.map(([mode]) => mode);

  it.each([
    ['Enter', '\r'],
    ['newline', '\n'],
    ['Ctrl-D', '\u0004'],
  ])('reads the typed password, applying backspace, ended by %s', async (_name, end) => {
    const user = `tty-${_name.toLowerCase()}`;
    const { code, stdin, out, err } = await run(user, `${PASSWORD}abc\u007fd${end}ignored`);
    expect(code).toBe(0);
    expect(rawModes(stdin)).toEqual([true, false]);
    expect(stdin.destroyed).toBe(true);
    expect(`${out}${err}`).not.toContain(PASSWORD);
    expect(err).toBe('Password: \n');
    expect((await verifyCredentials(t.db, user, `${PASSWORD}abd`))?.isAdmin).toBe(true);
  });

  it('aborts on Ctrl-C and restores the terminal', async () => {
    const { code, stdin, out, err } = await run('tty-abort', `${PASSWORD}\u0003`);
    expect(code).toBe(1);
    expect(err).toMatch(/aborted/i);
    expect(rawModes(stdin)).toEqual([true, false]);
    expect(stdin.destroyed).toBe(true);
    expect(`${out}${err}`).not.toContain(PASSWORD);
    expect(await verifyCredentials(t.db, 'tty-abort', PASSWORD)).toBeNull();
  });

  it('rejects oversized typed input and restores the terminal', async () => {
    const { code, stdin, err } = await run('tty-big', 'x'.repeat(2048));
    expect(code).toBe(1);
    expect(err).toMatch(/too long/i);
    expect(rawModes(stdin)).toEqual([true, false]);
  });

  it('uses the typed password when the input ends without Enter', async () => {
    const { code, stdin } = await run('tty-eof', PASSWORD);
    expect(code).toBe(0);
    expect(rawModes(stdin)).toEqual([true, false]);
    expect((await verifyCredentials(t.db, 'tty-eof', PASSWORD))?.isAdmin).toBe(true);
  });
});
