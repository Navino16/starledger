import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Kysely } from 'kysely';
import { loadConfig } from './config';
import { createDb } from './db/db';
import { migrateToLatest } from './db/migrate';
import type { Database } from './db/schema';
import { reparseEvents } from './ingest/reparse';
import { createUser } from './users/users';

export interface CliIo {
  stdin: AsyncIterable<string | Uint8Array> & {
    isTTY?: boolean;
    setRawMode?: (mode: boolean) => unknown;
  };
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  db: Kysely<Database>;
}

const USAGE = `Usage:
  node dist/cli.js create-admin --username <name>   (pipe the password via stdin)
  node dist/cli.js migrate
  node dist/cli.js reparse [--user <username>]
`;

const MAX_PASSWORD_BYTES = 1024;

class UsageError extends Error {}

async function readPiped(stdin: CliIo['stdin']): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stdin) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_PASSWORD_BYTES) throw new Error('Password input is too long');
    chunks.push(buf);
  }
  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
}

// Raw mode keeps the typed password from being echoed on an interactive terminal.
async function readHidden(stdin: CliIo['stdin'], stderr: CliIo['stderr']): Promise<string> {
  stderr.write('Password: ');
  stdin.setRawMode?.(true);
  let password = '';
  try {
    for await (const chunk of stdin) {
      for (const ch of Buffer.from(chunk).toString('utf8')) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return password;
        if (ch === '\u0003') throw new Error('Aborted');
        if (ch === '\u007f' || ch === '\b') password = password.slice(0, -1);
        else password += ch;
        if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
          throw new Error('Password input is too long');
        }
      }
    }
    return password;
  } finally {
    stdin.setRawMode?.(false);
    stderr.write('\n');
  }
}

const readPassword = (io: CliIo) =>
  io.stdin.isTTY ? readHidden(io.stdin, io.stderr) : readPiped(io.stdin);

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === 'migrate') {
      await migrateToLatest(io.db);
      io.stdout.write('Migrations applied\n');
      return 0;
    }
    if (command === 'create-admin') {
      let username: string | undefined;
      try {
        username = parseArgs({ args: rest, options: { username: { type: 'string' } } }).values
          .username;
      } catch (error) {
        throw new UsageError((error as Error).message);
      }
      if (!username) throw new UsageError('Missing --username');
      const password = await readPassword(io);
      const user = await createUser(io.db, {
        username,
        password,
        isAdmin: true,
        locale: 'en',
      });
      io.stdout.write(`Admin "${user.username}" created\n`);
      return 0;
    }
    if (command === 'reparse') {
      let user: string | undefined;
      try {
        user = parseArgs({ args: rest, options: { user: { type: 'string' } } }).values.user;
      } catch (error) {
        throw new UsageError((error as Error).message);
      }
      const log = {
        warn: (obj: object, msg: string) => io.stderr.write(`${msg} ${JSON.stringify(obj)}\n`),
      };
      const r = await reparseEvents(io.db, { username: user, log });
      io.stdout.write(
        `updated: ${r.updated}\nstillUnrecognized: ${r.stillUnrecognized}\nnewConflicts: ${r.newConflicts}\nskipped: ${r.skipped}\n`,
      );
      return 0;
    }
    io.stderr.write(USAGE);
    return 2;
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr.write(`${error.message}\n${USAGE}`);
      return 2;
    }
    io.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv[0] !== 'migrate' && argv[0] !== 'create-admin' && argv[0] !== 'reparse') {
    process.stderr.write(USAGE);
    process.exit(2);
  }
  let db: Kysely<Database> | undefined;
  try {
    db = createDb(loadConfig(process.env).databaseUrl);
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
  const code = await runCli(argv, {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    db,
  });
  await db.destroy();
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
