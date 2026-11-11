import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/db';

async function main(): Promise<void> {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    process.stderr.write(
      `Invalid configuration: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
  const db = createDb(config.databaseUrl);
  const app = buildApp(config, db);

  const shutdown = async () => {
    await app.close();
    await db.destroy();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  await app.listen({ host: '0.0.0.0', port: config.port });
}

await main();
