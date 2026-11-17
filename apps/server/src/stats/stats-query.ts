import { accountRefSchema, LANG_PATTERN } from '@app/shared';
import { z } from 'zod';
import type { StatsQuery } from './stats-service';

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

// Shared by /api/v1/stats and /api/site/stats.
export const statsQuerySchema = z
  .object({
    serverId: integerParam(accountRefSchema.shape.serverId),
    lang: z.string().regex(LANG_PATTERN),
    playerId: integerParam(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)),
    period: z.enum(['day', 'week', 'month', 'all', 'custom']),
    today: realDay('today'),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .refine(
    (q) =>
      q.period !== 'custom' ||
      (q.from !== undefined &&
        q.to !== undefined &&
        isRealDay(q.from) &&
        isRealDay(q.to) &&
        q.from <= q.to),
    'custom needs real days with from <= to',
  );

export function toStatsQuery(data: z.infer<typeof statsQuerySchema>): StatsQuery {
  const { from, to, ...rest } = data;
  const custom = rest.period === 'custom' && from && to ? { from, to } : undefined;
  return { ...rest, custom };
}
