import {
  API_RATE_LIMIT_PER_MINUTE,
  type ApiError,
  isVersionBelow,
  MIN_CLIENT_VERSION,
  parseSemver,
} from '@app/shared';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import { authenticateApiKey } from '../auth/api-keys';
import type { Database } from '../db/schema';
import { observationRoutes } from './routes-observations';
import { pingRoutes } from './routes-ping';
import { statsRoutes } from './routes-stats';

export interface ApiUser {
  userId: string;
  username: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiUser: ApiUser | null;
  }
}

const BEARER = /^bearer +(\S+)$/i;

function sendError(reply: FastifyReply, status: number, error: ApiError, message: string) {
  return reply.status(status).send({ error, message });
}

async function resolveApiUser(db: Kysely<Database>, header: string | undefined) {
  const key = header ? BEARER.exec(header)?.[1] : undefined;
  if (!key) return null;
  const auth = await authenticateApiKey(db, key);
  if (!auth) return null;
  const user = await db
    .selectFrom('users')
    .select(['id', 'username'])
    .where('id', '=', auth.userId)
    .executeTakeFirst();
  return user ? { userId: user.id, username: user.username } : null;
}

// Hook order: identify -> rate limit -> reject. Failed auth is rate limited by IP, authenticated calls by userId (never the raw key).
// The version gate runs after auth: an unauthenticated caller learns nothing about the minimum version.
export async function apiPlugin(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  const { db } = opts;
  app.decorateRequest('apiUser', null);

  app.setErrorHandler(async (error: { statusCode?: number; message: string }, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status === 429) {
      return sendError(reply, 429, 'rate_limited', 'Too many requests. Try again in a minute.');
    }
    if (status >= 500) {
      request.log.error(error);
      return sendError(reply, 500, 'server_error', 'Internal server error.');
    }
    if (status === 413) {
      return sendError(reply, 413, 'payload_too_large', 'Request body is too large.');
    }
    return sendError(reply, status, 'invalid_payload', error.message);
  });

  app.setNotFoundHandler(async (request, reply) => {
    request.log.info(
      `Route ${request.method}:${request.routeOptions.url ?? request.url} not found`,
    );
    return sendError(reply, 404, 'not_found', 'Unknown API endpoint.');
  });

  app.addHook('preHandler', async (request) => {
    request.apiUser = await resolveApiUser(db, request.headers.authorization);
  });

  await app.register(fastifyRateLimit, { global: false });
  app.addHook(
    'preHandler',
    app.rateLimit({
      max: API_RATE_LIMIT_PER_MINUTE,
      timeWindow: '1 minute',
      keyGenerator: (request: FastifyRequest) => request.apiUser?.userId ?? request.ip,
    }),
  );

  app.addHook('preHandler', async (request, reply) => {
    if (!request.apiUser) {
      return sendError(reply, 401, 'invalid_key', 'Missing, malformed or revoked API key.');
    }
    const version = request.headers['x-client-version'];
    if (typeof version !== 'string' || !parseSemver(version)) {
      return sendError(
        reply,
        400,
        'invalid_payload',
        'X-Client-Version must be MAJOR.MINOR.PATCH.',
      );
    }
    if (isVersionBelow(version, MIN_CLIENT_VERSION)) {
      return sendError(
        reply,
        426,
        'client_outdated',
        `Client ${version} is too old; update to ${MIN_CLIENT_VERSION} or later.`,
      );
    }
  });

  await app.register(pingRoutes);
  await app.register(observationRoutes, { db });
  await app.register(statsRoutes, { db });
}
