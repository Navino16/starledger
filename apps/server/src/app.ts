import { fileURLToPath } from 'node:url';
import fastifyCsrfProtection from '@fastify/csrf-protection';
import fastifyFormbody from '@fastify/formbody';
import fastifySecureSession from '@fastify/secure-session';
import fastifyView from '@fastify/view';
import { Eta } from 'eta';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { apiPlugin } from './api/plugin';
import type { Config } from './config';
import type { Database } from './db/schema';
import { loadUser } from './web/auth';
import { accountRoutes } from './web/routes-account';
import { authRoutes, redactUrl, registerErrorPages } from './web/routes-auth';
import { inviteRoutes } from './web/routes-invite';

// Resolves from src/ in tests and from dist/ once built (views are copied next to the bundle).
const VIEWS_DIR = fileURLToPath(new URL('./web/views', import.meta.url));

// Fastify 5.12 fails closed on a numeric trustProxy (ignores all X-Forwarded-*), so a hop count becomes
// a function; it assumes the app is only reachable through the proxy (PLAN scope 6).
function toTrustProxy(value: Config['trustProxy']) {
  return typeof value === 'number' ? (_address: string, hop: number) => hop < value : value;
}

const logSerializers = {
  req: (request: FastifyRequest) => ({
    method: request.method,
    url: redactUrl(request.url),
    host: request.host,
    remoteAddress: request.ip,
    remotePort: request.socket?.remotePort,
  }),
};

async function webRoutes(app: FastifyInstance, opts: { db: Kysely<Database>; config: Config }) {
  app.addHook('onRequest', loadUser(opts.db));
  registerErrorPages(app);
  await app.register(authRoutes, { db: opts.db });
  await app.register(accountRoutes, { db: opts.db });
  await app.register(inviteRoutes, opts);
}

export function buildApp(
  config: Config,
  db: Kysely<Database>,
  options: { logger?: boolean; logStream?: NodeJS.WritableStream } = {},
): FastifyInstance {
  const app = Fastify({
    trustProxy: toTrustProxy(config.trustProxy),
    logger:
      options.logger || options.logStream
        ? { level: 'info', serializers: logSerializers, stream: options.logStream }
        : false,
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

  app.register(apiPlugin, { db, prefix: '/api/v1' });
  app.register(webRoutes, { db, config });
  return app;
}
