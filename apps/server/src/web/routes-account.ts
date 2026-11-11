import { LANG_PATTERN, MAX_SERVER_ID } from '@app/shared';
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

const SERVER_ID_PATTERN = /^\d{1,10}$/;

interface FailedSave {
  serverId: number;
  lang: string;
  body: Record<string, unknown>;
  message: string;
}

const text = (body: Record<string, unknown>, name: string) =>
  typeof body[name] === 'string' ? body[name] : '';

export async function accountRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  const { db } = opts;
  const withCsrf = { preHandler: [requireUser, app.csrfProtection] };

  const accountPage = async (
    request: FastifyRequest,
    reply: FastifyReply,
    newKey: string | null,
    failed: FailedSave | null = null,
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
      universes.map(async (u) => {
        const saved = await getValuationSettings(db, user.id, u.server_id, u.lang);
        const base = { serverId: u.server_id, lang: u.lang, error: null as string | null };
        if (failed?.serverId === u.server_id && failed.lang === u.lang) {
          const b = failed.body;
          return {
            ...base,
            error: failed.message,
            msuMetal: text(b, 'msuMetal'),
            msuCrystal: text(b, 'msuCrystal'),
            msuDeuterium: text(b, 'msuDeuterium'),
            expeditionShipRatio: text(b, 'expeditionShipRatio'),
            ignoreExpeShipsLoss: b.ignoreExpeShipsLoss !== undefined,
            ignoreConsumption: b.ignoreConsumption !== undefined,
            includeTradesInBalance: b.includeTradesInBalance !== undefined,
          };
        }
        return {
          ...base,
          msuMetal: String(saved.msuRatio[0]),
          msuCrystal: String(saved.msuRatio[1]),
          msuDeuterium: String(saved.msuRatio[2]),
          expeditionShipRatio: String(saved.expeditionShipRatio),
          ignoreExpeShipsLoss: saved.ignoreExpeShipsLoss,
          ignoreConsumption: saved.ignoreConsumption,
          includeTradesInBalance: saved.includeTradesInBalance,
        };
      }),
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
    // Validated before any query: out-of-range ids or odd characters would make Postgres throw a 500.
    const wellFormed =
      SERVER_ID_PATTERN.test(params.serverId) &&
      serverId >= 1 &&
      serverId <= MAX_SERVER_ID &&
      LANG_PATTERN.test(params.lang);
    const owned =
      wellFormed &&
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
      const body = (request.body ?? {}) as Record<string, unknown>;
      const failed = { serverId, lang: params.lang, body, message: t('settings.invalid') };
      return accountPage(request, reply, null, failed, 400);
    }
    await saveValuationSettings(db, user.id, serverId, params.lang, settings);
    return reply.redirect('/account');
  });
}
