import {
  type Observation,
  PARSER_VERSION,
  type ParseResult,
  parseFleetDispatch,
  parseMessage,
} from '@app/shared';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../db/schema';
import type { IngestLogger } from './ingest';
import { mergeReading } from './merge';

export interface ReparseResult {
  updated: number;
  stillUnrecognized: number;
  newConflicts: number;
  skipped: number;
}

export class UnknownUserError extends Error {}

function interpret(obs: Observation, externalKey: string, log?: IngestLogger): ParseResult {
  try {
    return obs.kind === 'message' ? parseMessage(obs) : parseFleetDispatch(obs);
  } catch (error) {
    log?.warn({ externalKey, error: String(error) }, 'parser threw; event treated as unrecognized');
    return { status: 'unrecognized', externalKey, occurredAt: null, reason: 'parser error' };
  }
}

export async function reparseEvents(
  db: Kysely<Database>,
  opts: { username?: string; log?: IngestLogger } = {},
): Promise<ReparseResult> {
  let userId: string | undefined;
  if (opts.username !== undefined) {
    const user = await db
      .selectFrom('users')
      .select('id')
      .where('username', '=', opts.username.trim().toLowerCase())
      .executeTakeFirst();
    if (!user) throw new UnknownUserError(`Unknown user "${opts.username}"`);
    userId = user.id;
  }

  let query = db
    .selectFrom('events')
    .innerJoin('accounts', 'accounts.id', 'events.account_id')
    .select('events.id')
    .where((eb) =>
      eb.or([
        eb('events.status', '=', 'unrecognized'),
        eb('events.parser_version', '<', PARSER_VERSION),
      ]),
    )
    .orderBy('events.id');
  if (userId !== undefined) query = query.where('accounts.user_id', '=', userId);
  const ids = (await query.execute()).map((r) => r.id);

  const counts: ReparseResult = { updated: 0, stillUnrecognized: 0, newConflicts: 0, skipped: 0 };
  for (const id of ids) {
    try {
      await db.transaction().execute((trx) => reparseOne(trx, id, counts, opts.log));
    } catch (error) {
      // Only data-specific failures (SQLSTATE class 22/23) skip the event; anything else aborts the run.
      const code = (error as { code?: unknown }).code;
      if (typeof code !== 'string' || !/^2[23]/.test(code)) throw error;
      counts.skipped++;
      opts.log?.warn({ eventId: id, sqlState: code }, 'event skipped by reparse');
    }
  }
  return counts;
}

async function reparseOne(
  trx: Transaction<Database>,
  id: string,
  counts: ReparseResult,
  log?: IngestLogger,
): Promise<void> {
  const row = await trx
    .selectFrom('events')
    .innerJoin('observations', 'observations.id', 'events.first_observation_id')
    .select([
      'events.id',
      'events.status',
      'events.data',
      'events.external_key',
      'events.parser_version',
      'observations.payload',
    ])
    .where('events.id', '=', id)
    .forUpdate('events')
    .executeTakeFirst();
  if (!row || (row.status !== 'unrecognized' && row.parser_version >= PARSER_VERSION)) return;

  const obs = row.payload as Observation;
  const result = interpret(obs, row.external_key, log);
  const outcome = await mergeReading(trx, row, result, obs.serverUtcOffsetMinutes, {
    sameSource: true,
  });

  if (outcome === 'replaced') counts.updated++;
  else if (outcome === 'new_conflict') counts.newConflicts++;
  // An ok event that now reads as unrecognized keeps its data and is not counted.
  else if (row.status === 'unrecognized') counts.stillUnrecognized++;

  // Bump the version on every outcome so the event is not reprocessed on the next run.
  if (outcome !== 'replaced') {
    await trx
      .updateTable('events')
      .set({ parser_version: PARSER_VERSION })
      .where('id', '=', row.id)
      .execute();
  }
}
