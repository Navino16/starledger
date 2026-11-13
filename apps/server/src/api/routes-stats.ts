import { accountRefSchema, LANG_PATTERN } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../db/schema';
import { getStats } from '../stats/stats-service';
import { requireApiUser, sendError } from './errors';

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

// A regex alone accepts 2026-02-31; rebuild the date in UTC and require the same string.
function isRealDay(value: string): boolean {
  const m = DAY_KEY.exec(value);
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.toISOString().slice(0, 10) === value;
}

const integerParam = (schema: z.ZodNumber) =>
  z
    .string()
    .regex(/^\d{1,16}$/)
    .transform(Number)
    .pipe(schema);

const realDay = (name: string) =>
  z.string().refine(isRealDay, `${name} must be a real YYYY-MM-DD date`);

const statsQuerySchema = z
  .object({
    serverId: integerParam(accountRefSchema.shape.serverId),
    lang: z.string().regex(LANG_PATTERN),
    playerId: integerParam(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)),
    period: z.enum(['day', 'week', 'month', 'all', 'custom']),
    today: realDay('today'),
    from: realDay('from').optional(),
    to: realDay('to').optional(),
  })
  .refine(
    (q) => q.period !== 'custom' || (q.from !== undefined && q.to !== undefined && q.from <= q.to),
    'custom needs from <= to',
  );

export async function statsRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  app.get('/stats', async (request, reply) => {
    const query = statsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return sendError(reply, 400, 'invalid_payload', query.error.message);
    }
    const { userId } = requireApiUser(request);
    const { from, to, ...rest } = query.data;
    const custom = rest.period === 'custom' && from && to ? { from, to } : undefined;
    return getStats(opts.db, userId, { ...rest, custom });
  });
}
