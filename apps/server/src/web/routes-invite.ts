import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import type { Config } from '../config';
import type { Database } from '../db/schema';
import {
  consumeInvitation,
  createInvitation,
  InvitationError,
  isInvitationUsable,
} from '../users/invitations';
import { createUser, MIN_PASSWORD_LENGTH, UserInputError } from '../users/users';
import { requireAdmin, requireUser, startSession } from './auth';
import { negotiateLocale, translator } from './i18n';
import { localeOf, renderError, renderPage } from './routes-auth';

const SIGNUP_MAX_PER_MINUTE = 10;

const field = (body: unknown, name: string) => {
  const value = (body as Record<string, unknown> | null)?.[name];
  return typeof value === 'string' ? value : '';
};

export async function inviteRoutes(
  app: FastifyInstance,
  opts: { db: Kysely<Database>; config: Config },
) {
  const { db, config } = opts;
  const limited = {
    config: { rateLimit: { max: SIGNUP_MAX_PER_MINUTE, timeWindow: '1 minute' } },
    preHandler: app.csrfProtection,
  };

  await app.register(fastifyRateLimit, { global: false });

  const adminOnly = [requireUser, requireAdmin];

  app.get('/admin/invitations', { preHandler: adminOnly }, async (request, reply) => {
    const t = translator(localeOf(request));
    return renderPage(request, reply, 'admin-invitations.eta', {
      title: t('invitations.title'),
      url: null,
    });
  });

  app.post(
    '/admin/invitations',
    { preHandler: [...adminOnly, app.csrfProtection] },
    async (request, reply) => {
      const { url } = await createInvitation(db, request.user?.id as string, config.publicUrl);
      const t = translator(localeOf(request));
      reply.header('Cache-Control', 'no-store');
      return renderPage(request, reply, 'admin-invitations.eta', {
        title: t('invitations.title'),
        url,
      });
    },
  );

  const invalidInvitation = (request: FastifyRequest, reply: FastifyReply) =>
    renderError(request, reply, 410, 'invitations.invalid');

  const signupPage = (
    request: FastifyRequest,
    reply: FastifyReply,
    action: string,
    username = '',
    error: string | null = null,
  ) => {
    const t = translator(localeOf(request));
    return renderPage(
      request,
      reply,
      'signup.eta',
      { title: t('signup.title'), action, username, error, minPassword: MIN_PASSWORD_LENGTH },
      error ? 400 : 200,
    );
  };

  const inputErrorMessage = (request: FastifyRequest, error: UserInputError) =>
    translator(localeOf(request))(`signup.errors.${error.code}`, {
      min: String(MIN_PASSWORD_LENGTH),
    });

  app.get<{ Params: { token: string } }>('/invite/:token', async (request, reply) => {
    if (!(await isInvitationUsable(db, request.params.token))) {
      return invalidInvitation(request, reply);
    }
    return signupPage(request, reply, request.url);
  });

  app.post<{ Params: { token: string } }>('/invite/:token', limited, async (request, reply) => {
    const username = field(request.body, 'username');
    try {
      const user = await consumeInvitation(db, request.params.token, {
        username,
        password: field(request.body, 'password'),
        locale: negotiateLocale(request.headers['accept-language']),
      });
      startSession(request, user.id);
      return reply.redirect('/account');
    } catch (error) {
      if (error instanceof InvitationError) return invalidInvitation(request, reply);
      if (error instanceof UserInputError) {
        return signupPage(request, reply, request.url, username, inputErrorMessage(request, error));
      }
      throw error;
    }
  });

  if (!config.openSignup) return;

  app.get('/signup', async (request, reply) => signupPage(request, reply, '/signup'));

  app.post('/signup', limited, async (request, reply) => {
    const username = field(request.body, 'username');
    try {
      const user = await createUser(db, {
        username,
        password: field(request.body, 'password'),
        isAdmin: false,
        locale: negotiateLocale(request.headers['accept-language']),
      });
      startSession(request, user.id);
      return reply.redirect('/account');
    } catch (error) {
      if (error instanceof UserInputError) {
        return signupPage(request, reply, '/signup', username, inputErrorMessage(request, error));
      }
      throw error;
    }
  });
}
