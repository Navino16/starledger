import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Kysely } from 'kysely';
import { loadConfig } from './config';
import { createDb } from './db/db';
import { migrateToLatest } from './db/migrate';
import type { Database } from './db/schema';
import { createUser } from './users/users';

export interface CliIo {
  stdin: AsyncIterable<string | Uint8Array>;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  db: Kysely<Database>;
}

const USAGE = `Usage:
  node dist/cli.js create-admin --username <name>   (password read from stdin)
  node dist/cli.js migrate
`;

async function readPassword(stdin: CliIo['stdin']): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of stdin) chunks.push(chunk.toString());
  return chunks.join('').replace(/\r?\n$/, '');
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === 'migrate') {
      await migrateToLatest(io.db);
      io.stdout.write('Migrations applied\n');
      return 0;
    }
    if (command === 'create-admin') {
      const { values } = parseArgs({ args: rest, options: { username: { type: 'string' } } });
      if (!values.username) {
        io.stderr.write(`Missing --username\n${USAGE}`);
        return 2;
      }
      const password = await readPassword(io.stdin);
      const user = await createUser(io.db, {
        username: values.username,
        password,
        isAdmin: true,
        locale: 'en',
      });
      io.stdout.write(`Admin "${user.username}" created\n`);
      return 0;
    }
    io.stderr.write(USAGE);
    return 2;
  } catch (error) {
    io.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv[0] !== 'migrate' && argv[0] !== 'create-admin') {
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
