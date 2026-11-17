import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyError, FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { Config } from '../config';
import type { Database } from '../db/schema';
import { redactUrl } from '../redact';
import { SiteBodyError, sendSiteError } from './http';
import { accountRoutes } from './routes-account';
import { adminRoutes } from './routes-admin';
import { publicRoutes } from './routes-public';
import { sessionRoutes } from './routes-session';
import { statsRoutes } from './routes-stats';
import { loadUser } from './session';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Session-authenticated JSON API of the web app (spec web-front, "Architecture").
export async function sitePlugin(
  app: FastifyInstance,
  opts: { db: Kysely<Database>; config: Config },
) {
  app.addHook('onRequest', loadUser(opts.db));
  // Every answer is private to the session cookie: no shared cache may keep it (spec dashboard, Sécurité).
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
  });

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    if (error instanceof SiteBodyError) return sendSiteError(reply, 400, 'invalid_payload');
    if (error.code?.startsWith('FST_CSRF_')) return sendSiteError(reply, 403, 'csrf_invalid');
    const status = error.statusCode ?? 500;
    if (status === 429) return sendSiteError(reply, 429, 'rate_limited');
    if (status >= 500) {
      request.log.error(error);
      return sendSiteError(reply, 500, 'server_error');
    }
    if (status === 404) return sendSiteError(reply, 404, 'not_found');
    return sendSiteError(reply, 400, 'invalid_payload');
  });

  app.setNotFoundHandler(async (request, reply) => {
    request.log.info(`Route ${request.method}:${redactUrl(request.url)} not found`);
    return sendSiteError(reply, 404, 'not_found');
  });

  // The token travels in the x-csrf-token header, so it can be checked before the body is read.
  app.addHook('onRequest', (request, reply, done) => {
    if (SAFE_METHODS.has(request.method)) return done();
    app.csrfProtection(request, reply, done);
  });

  // Sub-plugins get db and config only: passing opts on would repeat the /api/site prefix.
  const deps = { db: opts.db, config: opts.config };
  await app.register(fastifyRateLimit, { global: false });
  await app.register(sessionRoutes, deps);
  await app.register(publicRoutes, deps);
  await app.register(accountRoutes, deps);
  await app.register(adminRoutes, deps);
  await app.register(statsRoutes, deps);
}
