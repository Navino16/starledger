import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import { generateApiKey, getActiveApiKey, revokeApiKey } from '../auth/api-keys';
import type { Database } from '../db/schema';
import {
  getValuationSettings,
  parseValuationForm,
  saveValuationSettings,
} from '../settings/settings';
import { requireUser, type WebUser } from './auth';
import { translator } from './i18n';
import { renderError, renderPage } from './routes-auth';

export async function accountRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  const { db } = opts;
  const withCsrf = { preHandler: [requireUser, app.csrfProtection] };

  const accountPage = async (
    request: FastifyRequest,
    reply: FastifyReply,
    newKey: string | null,
    settingsError: string | null = null,
    status = 200,
  ) => {
    const user = request.user as WebUser;
    const t = translator(user.locale);
    const active = await getActiveApiKey(db, user.id);
    const universes = await db
      .selectFrom('accounts')
      .select(['server_id', 'lang'])
      .distinct()
      .where('user_id', '=', user.id)
      .orderBy('server_id')
      .orderBy('lang')
      .execute();
    const settings = await Promise.all(
      universes.map(async (u) => ({
        serverId: u.server_id,
        lang: u.lang,
        ...(await getValuationSettings(db, user.id, u.server_id, u.lang)),
      })),
    );
    return renderPage(
      request,
      reply,
      'account.eta',
      {
        title: t('account.title'),
        username: user.username,
        isAdmin: user.isAdmin,
        apiKey: active && {
          prefix: active.prefix,
          createdAt: active.createdAt.toLocaleDateString(user.locale, { timeZone: 'UTC' }),
        },
        newKey,
        settings,
        settingsError,
      },
      status,
    );
  };

  app.get('/account', { preHandler: requireUser }, (request, reply) =>
    accountPage(request, reply, null),
  );

  app.post('/account/api-key', withCsrf, async (request, reply) => {
    const key = await generateApiKey(db, (request.user as WebUser).id);
    reply.header('Cache-Control', 'no-store');
    return accountPage(request, reply, key);
  });

  app.post('/account/api-key/revoke', withCsrf, async (request, reply) => {
    await revokeApiKey(db, (request.user as WebUser).id);
    return reply.redirect('/account');
  });

  app.post('/account/settings/:serverId/:lang', withCsrf, async (request, reply) => {
    const user = request.user as WebUser;
    const params = request.params as { serverId: string; lang: string };
    const serverId = Number(params.serverId);
    const owned =
      Number.isSafeInteger(serverId) &&
      serverId > 0 &&
      (await db
        .selectFrom('accounts')
        .select('id')
        .where('user_id', '=', user.id)
        .where('server_id', '=', serverId)
        .where('lang', '=', params.lang)
        .executeTakeFirst());
    if (!owned) return renderError(request, reply, 404, 'errors.notFound');
    const settings = parseValuationForm(request.body);
    if (!settings) {
      const t = translator(user.locale);
      return accountPage(request, reply, null, t('settings.invalid'), 400);
    }
    await saveValuationSettings(db, user.id, serverId, params.lang, settings);
    return reply.redirect('/account');
  });
}
