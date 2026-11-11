import { STATUS_CODES } from 'node:http';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { verifyCredentials } from '../users/users';
import { startSession } from './auth';
import { type Locale, negotiateLocale, translator } from './i18n';

const LOGIN_MAX_PER_MINUTE = 10;
const INVITE_TOKEN_PATH = /^\/invite\/[^/?#]+/;

// Invitation tokens are bearer secrets: keep them out of logs.
export const redactUrl = (url: string) => url.replace(INVITE_TOKEN_PATH, '/invite/[redacted]');

export const localeOf = (request: FastifyRequest): Locale =>
  request.user?.locale ?? negotiateLocale(request.headers['accept-language']);

export async function renderPage(
  request: FastifyRequest,
  reply: FastifyReply,
  template: string,
  data: Record<string, unknown>,
  status = 200,
) {
  const locale = localeOf(request);
  const t = translator(locale);
  return reply.status(status).view(template, {
    locale,
    t,
    csrfToken: reply.generateCsrf(),
    ...data,
  });
}

export async function renderError(
  request: FastifyRequest,
  reply: FastifyReply,
  status: number,
  messageKey: string,
) {
  const locale = localeOf(request);
  const t = translator(locale);
  return reply.status(status).view('error.eta', {
    locale,
    t,
    title: t('errors.title'),
    message: t(messageKey),
  });
}

export async function authRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  const { db } = opts;

  await app.register(fastifyRateLimit, { global: false });

  app.get('/', async (request, reply) => reply.redirect(request.user ? '/account' : '/login'));

  app.get('/login', async (request, reply) => {
    if (request.user) return reply.redirect('/account');
    const t = translator(localeOf(request));
    return renderPage(request, reply, 'login.eta', {
      title: t('login.title'),
      username: '',
      error: null,
    });
  });

  app.post(
    '/login',
    {
      config: { rateLimit: { max: LOGIN_MAX_PER_MINUTE, timeWindow: '1 minute' } },
      preHandler: app.csrfProtection,
    },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const username = typeof body.username === 'string' ? body.username : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const user = await verifyCredentials(db, username, password);
      if (!user) {
        const t = translator(localeOf(request));
        return renderPage(request, reply, 'login.eta', {
          title: t('login.title'),
          username,
          error: t('login.invalid'),
        });
      }
      startSession(request, user.id);
      return reply.redirect('/account');
    },
  );

  app.post('/logout', { preHandler: app.csrfProtection }, async (request, reply) => {
    request.session.delete();
    return reply.redirect('/login');
  });
}

export function registerErrorPages(app: FastifyInstance) {
  // Fastify's default 404 handler logs the raw URL, bypassing the req serializer.
  app.setNotFoundHandler(async (request, reply) => {
    request.log.info(`Route ${request.method}:${redactUrl(request.url)} not found`);
    return renderError(request, reply, 404, 'errors.notFound');
  });

  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    let messageKey: string | null = null;
    if (status === 429) messageKey = 'errors.rateLimit';
    else if (error.code?.startsWith('FST_CSRF_')) messageKey = 'errors.csrf';
    else if (status === 403) messageKey = 'errors.forbidden';
    if (messageKey) return renderError(request, reply, status, messageKey);
    if (status >= 500) {
      request.log.error(error);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error' });
    }
    return reply
      .status(status)
      .send({ statusCode: status, error: STATUS_CODES[status] ?? 'Error' });
  });
}
