import { dayKey, PARSER_VERSION, type ParseResult } from '@app/shared';
import type { Transaction } from 'kysely';
import type { Database } from '../db/schema';
import { canonicalJson } from './canonical';

export interface ExistingEvent {
  id: string;
  status: 'ok' | 'unrecognized' | 'conflict';
  data: unknown;
}

export type MergeOutcome = 'replaced' | 'unchanged' | 'kept' | 'conflict' | 'new_conflict';

export interface MergeOptions {
  // Reparse: the new reading comes from the event's own source observation, so a difference means the parser changed.
  sameSource?: boolean;
  // Ingestion: the observation that becomes the data source when it replaces an unrecognized event.
  observationId?: string;
}

// Merge rules for a new reading of an already stored event (shared by ingestion and reparse).
export async function mergeReading(
  trx: Transaction<Database>,
  existing: ExistingEvent,
  result: ParseResult,
  serverUtcOffsetMinutes: number,
  opts: MergeOptions = {},
): Promise<MergeOutcome> {
  // A weaker reading never touches an existing event; the raw stays in observations.payload.
  if (result.status !== 'ok') return 'kept';

  const same = canonicalJson(existing.data) === canonicalJson(result.event);
  const replace =
    existing.status === 'unrecognized' ||
    (opts.sameSource && (existing.status === 'conflict' || !same));
  if (replace) {
    await trx
      .updateTable('events')
      .set({
        data: JSON.stringify(result.event),
        status: 'ok',
        kind: result.event.kind,
        occurred_at: new Date(result.occurredAt),
        day: dayKey(result.occurredAt, serverUtcOffsetMinutes),
        parser_version: PARSER_VERSION,
        ...(opts.observationId !== undefined && existing.status === 'unrecognized'
          ? { first_observation_id: opts.observationId }
          : {}),
      })
      .where('id', '=', existing.id)
      .execute();
    return 'replaced';
  }

  if (same) return 'unchanged';
  if (existing.status === 'conflict') return 'conflict';
  await trx
    .updateTable('events')
    .set({ status: 'conflict' })
    .where('id', '=', existing.id)
    .execute();
  return 'new_conflict';
}
