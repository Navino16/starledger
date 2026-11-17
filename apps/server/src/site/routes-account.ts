import {
  changePasswordRequestSchema,
  createKeyRequestSchema,
  LANG_PATTERN,
  MAX_SERVER_ID,
  valuationSettingsSchema,
} from '@app/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import { ApiKeyNameError, createApiKey, listApiKeys, revokeApiKey } from '../auth/api-keys';
import type { Database } from '../db/schema';
import { getValuationSettings, saveValuationSettings } from '../settings/settings';
import { CurrentPasswordError, changePassword } from '../users/passwords';
import { UserInputError } from '../users/users';
import { currentUser, parseBody, perMinute, requireSiteUser, sendSiteError } from './http';

const PASSWORD_MAX_PER_MINUTE = 10;
const SERVER_ID_PATTERN = /^\d{1,10}$/;

export async function accountRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  const { db } = opts;
  app.addHook('preHandler', requireSiteUser);

  app.get('/api-keys', async (request) => {
    const keys = await listApiKeys(db, currentUser(request).id);
    return {
      keys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      })),
    };
  });

  app.post('/api-keys', async (request, reply) => {
    const { name } = parseBody(createKeyRequestSchema, request.body);
    try {
      const created = await createApiKey(db, currentUser(request).id, name);
      return reply.status(201).send(created);
    } catch (error) {
      if (error instanceof ApiKeyNameError) return sendSiteError(reply, 400, 'name_invalid');
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>('/api-keys/:id', async (request, reply) => {
    const revoked = await revokeApiKey(db, currentUser(request).id, request.params.id);
    if (!revoked) return sendSiteError(reply, 404, 'not_found');
    return reply.status(204).send();
  });

  app.post(
    '/password',
    {
      config: {
        rateLimit: {
          ...perMinute(PASSWORD_MAX_PER_MINUTE).config.rateLimit,
          keyGenerator: (request: FastifyRequest) => request.user?.id ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      const body = parseBody(changePasswordRequestSchema, request.body);
      try {
        const { sessionVersion } = await changePassword(
          db,
          currentUser(request).id,
          body.current,
          body.next,
        );
        // Only this session survives the version bump.
        request.session.set('sessionVersion', sessionVersion);
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof CurrentPasswordError) {
          return sendSiteError(reply, 400, 'current_invalid');
        }
        if (error instanceof UserInputError) return sendSiteError(reply, 400, error.code);
        throw error;
      }
    },
  );

  app.get('/settings', async (request) => {
    const userId = currentUser(request).id;
    const universes = await db
      .selectFrom('accounts')
      .select(['server_id', 'lang'])
      .distinct()
      .where('user_id', '=', userId)
      .orderBy('server_id')
      .orderBy('lang')
      .execute();
    return {
      universes: await Promise.all(
        universes.map(async (u) => ({
          serverId: u.server_id,
          lang: u.lang,
          settings: await getValuationSettings(db, userId, u.server_id, u.lang),
        })),
      ),
    };
  });

  app.put<{ Params: { serverId: string; lang: string } }>(
    '/settings/:serverId/:lang',
    async (request, reply) => {
      const userId = currentUser(request).id;
      const { serverId: rawId, lang } = request.params;
      const serverId = Number(rawId);
      // Validated before any query: out-of-range ids or odd characters would make Postgres throw a 500.
      const wellFormed =
        SERVER_ID_PATTERN.test(rawId) &&
        serverId >= 1 &&
        serverId <= MAX_SERVER_ID &&
        LANG_PATTERN.test(lang);
      const owned =
        wellFormed &&
        (await db
          .selectFrom('accounts')
          .select('id')
          .where('user_id', '=', userId)
          .where('server_id', '=', serverId)
          .where('lang', '=', lang)
          .executeTakeFirst());
      if (!owned) return sendSiteError(reply, 404, 'not_found');
      const parsed = valuationSettingsSchema.safeParse(request.body);
      if (!parsed.success) return sendSiteError(reply, 400, 'settings_invalid');
      await saveValuationSettings(db, userId, serverId, lang, parsed.data);
      return { settings: parsed.data };
    },
  );
}
