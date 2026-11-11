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

// Merge rules for a new reading of an already stored event (shared by ingestion and reparse).
export async function mergeReading(
  trx: Transaction<Database>,
  existing: ExistingEvent,
  result: ParseResult,
  serverUtcOffsetMinutes: number,
): Promise<MergeOutcome> {
  // A weaker reading never touches an existing event; the raw stays in observations.payload.
  if (result.status !== 'ok') return 'kept';

  if (existing.status === 'unrecognized') {
    await trx
      .updateTable('events')
      .set({
        data: JSON.stringify(result.event),
        status: 'ok',
        kind: result.event.kind,
        occurred_at: new Date(result.occurredAt),
        day: dayKey(result.occurredAt, serverUtcOffsetMinutes),
        parser_version: PARSER_VERSION,
      })
      .where('id', '=', existing.id)
      .execute();
    return 'replaced';
  }

  if (canonicalJson(existing.data) === canonicalJson(result.event)) return 'unchanged';
  if (existing.status === 'conflict') return 'conflict';
  await trx
    .updateTable('events')
    .set({ status: 'conflict' })
    .where('id', '=', existing.id)
    .execute();
  return 'new_conflict';
}
