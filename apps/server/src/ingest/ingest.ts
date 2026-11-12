import {
  type AckStatus,
  type BatchAck,
  dayKey,
  type Observation,
  type ObservationBatch,
  observationExternalKey,
  observationSchema,
  PARSER_VERSION,
  type ParseResult,
  parseObservation,
} from '@app/shared';
import { type Kysely, sql, type Transaction } from 'kysely';
import type { Database } from '../db/schema';
import { mergeReading } from './merge';

export interface IngestLogger {
  warn: (obj: object, msg: string) => void;
}

export type LaxBatch = Omit<ObservationBatch, 'observations'> & { observations: unknown[] };

type Ack = BatchAck['results'][number];

export async function ingestBatch(
  db: Kysely<Database>,
  userId: string,
  batch: LaxBatch,
  log?: IngestLogger,
): Promise<BatchAck> {
  return db.transaction().execute(async (trx) => {
    const now = new Date();
    await trx
      .insertInto('devices')
      .values({
        user_id: userId,
        device_id: batch.deviceId,
        client_version: batch.clientVersion,
        first_seen: now,
        last_seen: now,
      })
      .onConflict((oc) =>
        oc.columns(['user_id', 'device_id']).doUpdateSet({
          last_seen: now,
          client_version: batch.clientVersion,
        }),
      )
      .execute();

    const results: Ack[] = [];
    for (const raw of batch.observations) {
      results.push(await ingestOne(trx, userId, batch.deviceId, raw, log));
    }
    return { results };
  });
}

function idOf(raw: unknown): string {
  const id = (raw as { clientObservationId?: unknown } | null)?.clientObservationId;
  return typeof id === 'string' ? id : '';
}

// One savepoint per observation: a failing statement must not abort the whole batch transaction.
async function ingestOne(
  trx: Transaction<Database>,
  userId: string,
  deviceId: string,
  raw: unknown,
  log?: IngestLogger,
): Promise<Ack> {
  const parsed = observationSchema.safeParse(raw);
  if (!parsed.success) {
    return { clientObservationId: idOf(raw), status: 'rejected', reason: parsed.error.message };
  }
  const obs = parsed.data;
  await sql`savepoint observation`.execute(trx);
  try {
    const status = await ingestValid(trx, userId, deviceId, obs, log);
    await sql`release savepoint observation`.execute(trx);
    return { clientObservationId: obs.clientObservationId, status };
  } catch (error) {
    // Only data-specific failures (SQLSTATE class 22/23) are rejected; anything else must fail the request so the client retries.
    const code = (error as { code?: unknown }).code;
    if (typeof code !== 'string' || !/^2[23]/.test(code)) throw error;
    await sql`rollback to savepoint observation`.execute(trx);
    log?.warn(
      { clientObservationId: obs.clientObservationId, sqlState: code },
      'observation rejected by database',
    );
    return {
      clientObservationId: obs.clientObservationId,
      status: 'rejected',
      reason: `database rejected the observation (${code})`,
    };
  }
}

function interpret(obs: Observation, log?: IngestLogger): ParseResult {
  try {
    return parseObservation(obs);
  } catch (error) {
    log?.warn(
      { clientObservationId: obs.clientObservationId, error: String(error) },
      'parser threw; observation treated as unrecognized',
    );
    const externalKey = observationExternalKey(obs);
    return { status: 'unrecognized', externalKey, occurredAt: null, reason: 'parser error' };
  }
}

async function ingestValid(
  trx: Transaction<Database>,
  userId: string,
  deviceId: string,
  obs: Observation,
  log?: IngestLogger,
): Promise<AckStatus> {
  const result = interpret(obs, log);

  // The DO UPDATE row lock serialises concurrent batches on one account, which keeps duplicate detection race-free; DO NOTHING + SELECT would reopen the race.
  const account = await trx
    .insertInto('accounts')
    .values({
      user_id: userId,
      server_id: obs.account.serverId,
      lang: obs.account.lang,
      player_id: obs.account.playerId,
      player_name: obs.account.playerName,
      created_at: new Date(),
    })
    .onConflict((oc) =>
      oc.columns(['user_id', 'server_id', 'lang', 'player_id']).doUpdateSet((eb) => ({
        player_name: eb.fn.coalesce('excluded.player_name', 'accounts.player_name'),
      })),
    )
    .returning('id')
    .executeTakeFirstOrThrow();

  const inserted = await trx
    .insertInto('observations')
    .values({
      user_id: userId,
      account_id: account.id,
      device_id: deviceId,
      client_observation_id: obs.clientObservationId,
      kind: obs.kind,
      external_key: result.externalKey,
      payload: JSON.stringify(obs),
      observed_at: new Date(obs.observedAt),
      created_at: new Date(),
    })
    .onConflict((oc) => oc.columns(['user_id', 'client_observation_id']).doNothing())
    .returning('id')
    .executeTakeFirst();
  if (!inserted) return 'duplicate';

  const ok = result.status === 'ok';
  const occurredAt = result.occurredAt === null ? null : new Date(result.occurredAt);
  const day =
    result.occurredAt === null ? null : dayKey(result.occurredAt, obs.serverUtcOffsetMinutes);
  const data = ok ? JSON.stringify(result.event) : null;
  const kind = ok ? result.event.kind : null;

  const event = await trx
    .insertInto('events')
    .values({
      account_id: account.id,
      external_key: result.externalKey,
      kind,
      status: ok ? 'ok' : 'unrecognized',
      occurred_at: occurredAt,
      day,
      data,
      parser_version: PARSER_VERSION,
      first_observation_id: inserted.id,
      created_at: new Date(),
    })
    .onConflict((oc) => oc.columns(['account_id', 'external_key']).doNothing())
    .returning('id')
    .executeTakeFirst();
  if (event) return ok ? 'accepted' : 'unrecognized';

  const existing = await trx
    .selectFrom('events')
    .select(['id', 'status', 'data'])
    .where('account_id', '=', account.id)
    .where('external_key', '=', result.externalKey)
    .executeTakeFirstOrThrow();

  const outcome = await mergeReading(trx, existing, result, obs.serverUtcOffsetMinutes, {
    observationId: inserted.id,
  });
  if (outcome === 'replaced') return 'accepted';
  if (outcome === 'conflict' || outcome === 'new_conflict') return 'conflict';
  return 'duplicate';
}
