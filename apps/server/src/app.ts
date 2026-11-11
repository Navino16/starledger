import fastifyCsrfProtection from '@fastify/csrf-protection';
import fastifyFormbody from '@fastify/formbody';
import fastifySecureSession from '@fastify/secure-session';
import fastifyView from '@fastify/view';
import { Eta } from 'eta';
import Fastify, { type FastifyInstance } from 'fastify';
import { type Kysely, sql } from 'kysely';
import type { Config } from './config';
import type { Database } from './db/schema';
import { authRoutes } from './web/routes-auth';

// Resolves from src/ in tests and from dist/ once built (views are copied next to the bundle).
const VIEWS_DIR = new URL('./web/views', import.meta.url).pathname;

export function buildApp(config: Config, db: Kysely<Database>): FastifyInstance {
  const app = Fastify({ trustProxy: config.trustProxy });

  app.register(fastifyFormbody);
  app.register(fastifySecureSession, {
    key: Buffer.from(config.sessionSecret, 'hex'),
    // secure 'auto' follows request.protocol, which honors X-Forwarded-Proto under trustProxy.
    cookie: { path: '/', httpOnly: true, sameSite: 'lax', secure: 'auto' },
  });
  app.register(fastifyCsrfProtection, { sessionPlugin: '@fastify/secure-session' });
  app.register(fastifyView, {
    engine: { eta: new Eta({ views: VIEWS_DIR }) },
    root: VIEWS_DIR,
    layout: 'layout.eta',
  });

  app.get('/healthz', async (_request, reply) => {
    try {
      await sql`select 1`.execute(db);
      return { ok: true };
    } catch {
      return reply.status(503).send({ ok: false });
    }
  });

  app.register(authRoutes, { db });
  return app;
}
