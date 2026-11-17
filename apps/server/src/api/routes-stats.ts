import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { statsQuerySchema, toStatsQuery } from '../stats/stats-query';
import { getStats } from '../stats/stats-service';
import { requireApiUser, sendError } from './errors';

export async function statsRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  app.get('/stats', async (request, reply) => {
    const query = statsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return sendError(reply, 400, 'invalid_payload', query.error.message);
    }
    const { userId } = requireApiUser(request);
    return getStats(opts.db, userId, toStatsQuery(query.data));
  });
}
