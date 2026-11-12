import {
  computeStats,
  type ParsedEvent,
  type Period,
  periodRange,
  type StatsResponse,
  type StoredEvent,
  type ValuationSettings,
} from '@app/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { getValuationSettings } from '../settings/settings';

export interface StatsQuery {
  serverId: number;
  lang: string;
  playerId: number;
  period: Period;
  today: string;
}

function dailyMsu(
  month: { from: string; to: string } | null,
  events: StoredEvent[],
  settings: ValuationSettings,
): { day: string; msu: number }[] {
  if (!month) return [];
  const byDay = new Map<string, StoredEvent[]>();
  for (const e of events) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const days: { day: string; msu: number }[] = [];
  const last = Number(month.to.slice(8));
  for (let d = 1; d <= last; d++) {
    const day = `${month.from.slice(0, 8)}${String(d).padStart(2, '0')}`;
    const dayEvents = byDay.get(day);
    days.push({ day, msu: dayEvents ? computeStats(dayEvents, settings).tiles.msu : 0 });
  }
  return days;
}

// Every query is scoped by user_id: an account of another user is indistinguishable from an unknown one.
export async function getStats(
  db: Kysely<Database>,
  userId: string,
  query: StatsQuery,
): Promise<StatsResponse> {
  const { serverId, lang, playerId, period, today } = query;
  const range = periodRange(period, today);
  const monthRange = periodRange('month', today);
  const settings = await getValuationSettings(db, userId, serverId, lang);

  const account = await db
    .selectFrom('accounts')
    .select('id')
    .where('user_id', '=', userId)
    .where('server_id', '=', serverId)
    .where('lang', '=', lang)
    .where('player_id', '=', String(playerId))
    .executeTakeFirst();

  let events: StoredEvent[] = [];
  let monthEvents: StoredEvent[] = [];
  let unrecognized = 0;
  if (account) {
    const fetchEvents = async (r: { from: string; to: string } | null) => {
      let okQuery = db
        .selectFrom('events')
        .select(['day', 'status', 'data'])
        .where('account_id', '=', account.id)
        .where('status', 'in', ['ok', 'conflict']);
      if (r) okQuery = okQuery.where('day', '>=', r.from).where('day', '<=', r.to);
      const rows = await okQuery.execute();
      return rows.flatMap((row): StoredEvent[] =>
        row.day && row.data && (row.status === 'ok' || row.status === 'conflict')
          ? [{ day: row.day, status: row.status, event: row.data as ParsedEvent }]
          : [],
      );
    };
    events = await fetchEvents(range);
    monthEvents = period === 'month' ? events : await fetchEvents(monthRange);
    const count = await db
      .selectFrom('events')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('account_id', '=', account.id)
      .where('status', '=', 'unrecognized')
      .executeTakeFirstOrThrow();
    unrecognized = Number(count.n);
  }

  return {
    period,
    range,
    generatedAt: Date.now(),
    summary: computeStats(events, settings),
    days: dailyMsu(monthRange, monthEvents, settings),
    counts: { unrecognized },
    settings,
  };
}
