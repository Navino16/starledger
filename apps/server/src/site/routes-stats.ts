import { API_RATE_LIMIT_PER_MINUTE } from '@app/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { statsQuerySchema, toStatsQuery } from '../stats/stats-query';
import { getStats } from '../stats/stats-service';
import { currentUser, parseBody, perMinute, requireSiteUser } from './http';

export async function statsRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  const { db } = opts;
  app.addHook('preHandler', requireSiteUser);

  app.get('/accounts', async (request) => {
    const rows = await db
      .selectFrom('accounts')
      .select(['server_id', 'lang', 'player_id', 'player_name'])
      .where('user_id', '=', currentUser(request).id)
      .orderBy('server_id')
      .orderBy('lang')
      .orderBy('player_id')
      .execute();
    return {
      accounts: rows.map((row) => ({
        serverId: row.server_id,
        lang: row.lang,
        playerId: Number(row.player_id),
        playerName: row.player_name,
      })),
    };
  });

  // period=all recomputes the whole history: same per-user limit as /api/v1 (spec dashboard, Sécurité).
  app.get(
    '/stats',
    {
      config: {
        rateLimit: {
          ...perMinute(API_RATE_LIMIT_PER_MINUTE).config.rateLimit,
          keyGenerator: (request: FastifyRequest) => request.user?.id ?? request.ip,
        },
      },
    },
    async (request) =>
      getStats(
        db,
        currentUser(request).id,
        toStatsQuery(parseBody(statsQuerySchema, request.query)),
      ),
  );
}
