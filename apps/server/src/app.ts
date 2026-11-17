import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyCsrfProtection from '@fastify/csrf-protection';
import fastifySecureSession from '@fastify/secure-session';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { apiPlugin } from './api/plugin';
import type { Config } from './config';
import type { Database } from './db/schema';
import { redactUrl } from './redact';
import { sitePlugin } from './site/plugin';

// The Docker image copies the web build to /app/public, next to /app/dist.
const DEFAULT_WEB_ROOT = fileURLToPath(new URL('../public', import.meta.url));

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

// 'unsafe-inline' styles: Recharts sets style attributes on its SVG (spec dashboard, Sécurité).
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

const isAppRoute = (request: FastifyRequest) => {
  const path = request.url.split('?')[0] ?? '';
  return (
    (request.method === 'GET' || request.method === 'HEAD') &&
    !path.startsWith('/api/') &&
    !path.startsWith('/assets/') &&
    path !== '/healthz'
  );
};

// Serves the React app: hashed assets are cached for good, index.html is revalidated on each visit.
function serveWebApp(app: FastifyInstance, webRoot: string) {
  const assets = join(webRoot, 'assets') + sep;
  app.register(fastifyStatic, {
    root: webRoot,
    cacheControl: false,
    setHeaders: (reply, path) => {
      reply.header(
        'Cache-Control',
        path.startsWith(assets) ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  });
}

export function buildApp(
  config: Config,
  db: Kysely<Database>,
  options: { logger?: boolean; logStream?: NodeJS.WritableStream; webRoot?: string } = {},
): FastifyInstance {
  const app = Fastify({
    trustProxy: toTrustProxy(config.trustProxy),
    logger:
      options.logger || options.logStream
        ? { level: 'info', serializers: logSerializers, stream: options.logStream }
        : false,
  });

  app.decorateRequest('user', null);
  app.addHook('onSend', async (_request, reply) => {
    reply.headers(SECURITY_HEADERS);
  });
  app.register(fastifySecureSession, {
    key: Buffer.from(config.sessionSecret, 'hex'),
    // secure 'auto' follows request.protocol, which honors X-Forwarded-Proto under trustProxy.
    // expiry bounds the replay window of the stateless cookie.
    expiry: 86400,
    cookie: { path: '/', httpOnly: true, sameSite: 'lax', secure: 'auto' },
  });
  app.register(fastifyCsrfProtection, { sessionPlugin: '@fastify/secure-session' });

  app.get('/healthz', async (_request, reply) => {
    try {
      await sql`select 1`.execute(db);
      return { ok: true };
    } catch {
      return reply.status(503).send({ ok: false });
    }
  });

  app.register(apiPlugin, { db, prefix: '/api/v1' });
  app.register(sitePlugin, { db, config, prefix: '/api/site' });

  const webRoot = options.webRoot ?? DEFAULT_WEB_ROOT;
  const hasWebApp = existsSync(join(webRoot, 'index.html'));
  if (hasWebApp) serveWebApp(app, webRoot);
  else app.log.warn(`No web app in ${webRoot}: only the APIs are served`);

  app.get('/admin/invitations', async (_request, reply) => reply.redirect('/admin', 301));

  // Routing happens client-side: any other page path gets index.html.
  app.setNotFoundHandler(async (request, reply) => {
    if (hasWebApp && isAppRoute(request)) return reply.sendFile('index.html');
    // Fastify's default 404 handler logs the raw URL, bypassing the req serializer.
    request.log.info(`Route ${request.method}:${redactUrl(request.url)} not found`);
    return reply.status(404).send({ error: 'not_found' });
  });

  return app;
}
