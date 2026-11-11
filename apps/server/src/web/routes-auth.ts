import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { verifyCredentials } from '../users/users';
import { sessionUser } from './auth';
import { type Locale, negotiateLocale, translator } from './i18n';

const LOGIN_MAX_PER_MINUTE = 10;

export const localeOf = (request: FastifyRequest): Locale =>
  sessionUser(request)?.locale ?? negotiateLocale(request.headers['accept-language']);

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

export async function authRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  const { db } = opts;

  await app.register(fastifyRateLimit, { global: false });

  app.get('/', async (request, reply) =>
    reply.redirect(sessionUser(request) ? '/account' : '/login'),
  );

  app.get('/login', async (request, reply) => {
    if (sessionUser(request)) return reply.redirect('/account');
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
      request.session.regenerate();
      request.session.set('userId', user.id);
      request.session.set('username', user.username);
      request.session.set('locale', user.locale);
      return reply.redirect('/account');
    },
  );

  app.post('/logout', { preHandler: app.csrfProtection }, async (request, reply) => {
    request.session.delete();
    return reply.redirect('/login');
  });

  app.get('/account', async (request, reply) => {
    const user = sessionUser(request);
    if (!user) return reply.redirect('/login');
    const t = translator(user.locale);
    return renderPage(request, reply, 'account.eta', {
      title: t('account.title'),
      username: user.username,
    });
  });
}

export function registerErrorPages(app: FastifyInstance) {
  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    const t = translator(localeOf(request));
    let message: string | null = null;
    if (status === 429) message = t('errors.rateLimit');
    else if (error.code?.startsWith('FST_CSRF_')) message = t('errors.csrf');
    if (message) {
      return reply.status(status).view('error.eta', {
        locale: localeOf(request),
        t,
        title: t('errors.title'),
        message,
      });
    }
    if (status >= 500) {
      request.log.error(error);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error' });
    }
    return reply.status(status).send({ statusCode: status, error: error.name });
  });
}
