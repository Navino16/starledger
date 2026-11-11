import { fileURLToPath } from 'node:url';
import fastifyCsrfProtection from '@fastify/csrf-protection';
import fastifyFormbody from '@fastify/formbody';
import fastifySecureSession from '@fastify/secure-session';
import fastifyView from '@fastify/view';
import { Eta } from 'eta';
import Fastify, { type FastifyInstance } from 'fastify';
import { type Kysely, sql } from 'kysely';
import type { Config } from './config';
import type { Database } from './db/schema';
import { authRoutes, registerErrorPages } from './web/routes-auth';
import { inviteRoutes } from './web/routes-invite';

// Resolves from src/ in tests and from dist/ once built (views are copied next to the bundle).
const VIEWS_DIR = fileURLToPath(new URL('./web/views', import.meta.url));

// Fastify 5.12 fails closed on a numeric trustProxy (ignores all X-Forwarded-*), so a hop count becomes
// a function; it assumes the app is only reachable through the proxy (PLAN scope 6).
function toTrustProxy(value: Config['trustProxy']) {
  return typeof value === 'number' ? (_address: string, hop: number) => hop < value : value;
}

export function buildApp(
  config: Config,
  db: Kysely<Database>,
  options: { logger?: boolean } = {},
): FastifyInstance {
  const app = Fastify({
    trustProxy: toTrustProxy(config.trustProxy),
    logger: options.logger ? { level: 'info' } : false,
  });

  app.decorateRequest('user', null);
  app.register(fastifyFormbody);
  app.register(fastifySecureSession, {
    key: Buffer.from(config.sessionSecret, 'hex'),
    // secure 'auto' follows request.protocol, which honors X-Forwarded-Proto under trustProxy.
    // expiry bounds the replay window of the stateless cookie.
    expiry: 86400,
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

  registerErrorPages(app);
  app.register(authRoutes, { db });
  app.register(inviteRoutes, { db, config });
  return app;
}
