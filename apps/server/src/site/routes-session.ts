import { loginRequestSchema } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { Config } from '../config';
import type { Database } from '../db/schema';
import { verifyCredentials } from '../users/users';
import { startSession } from '../web/auth';
import { localeOf } from '../web/routes-auth';
import { LOGIN_MAX_PER_MINUTE, parseBody, perMinute, sendSiteError, toSiteUser } from './http';

export async function sessionRoutes(
  app: FastifyInstance,
  opts: { db: Kysely<Database>; config: Config },
) {
  const { db, config } = opts;

  app.get('/session', async (request, reply) => ({
    user: request.user && toSiteUser(request.user),
    locale: localeOf(request),
    csrfToken: reply.generateCsrf(),
    openSignup: config.openSignup,
  }));

  app.post('/login', perMinute(LOGIN_MAX_PER_MINUTE), async (request, reply) => {
    const body = parseBody(loginRequestSchema, request.body);
    const user = await verifyCredentials(db, body.username, body.password);
    if (!user) return sendSiteError(reply, 401, 'invalid_credentials');
    startSession(request, user.id, user.sessionVersion);
    return { user: toSiteUser(user) };
  });

  app.post('/logout', async (request, reply) => {
    request.session.delete();
    return reply.status(204).send();
  });
}
