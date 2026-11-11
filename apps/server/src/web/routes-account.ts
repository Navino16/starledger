import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { generateApiKey, getActiveApiKey, revokeApiKey } from '../auth/api-keys';
import type { Database } from '../db/schema';
import { requireUser, type WebUser } from './auth';
import { translator } from './i18n';
import { renderPage } from './routes-auth';

export async function accountRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  const { db } = opts;
  const withCsrf = { preHandler: [requireUser, app.csrfProtection] };

  const accountPage = async (
    request: Parameters<typeof renderPage>[0],
    reply: Parameters<typeof renderPage>[1],
    newKey: string | null,
  ) => {
    const user = request.user as WebUser;
    const t = translator(user.locale);
    const active = await getActiveApiKey(db, user.id);
    return renderPage(request, reply, 'account.eta', {
      title: t('account.title'),
      username: user.username,
      isAdmin: user.isAdmin,
      apiKey: active && {
        prefix: active.prefix,
        createdAt: active.createdAt.toLocaleDateString(user.locale),
      },
      newKey,
    });
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
}
