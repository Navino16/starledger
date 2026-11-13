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

// True when `known` agrees with every value of `partial` and may only add values `partial` leaves
// unknown (null or absent), e.g. a newer collector reading what an older one could not.
function covers(known: unknown, partial: unknown): boolean {
  if (partial === null || partial === undefined) return true;
  if (Array.isArray(partial)) {
    return (
      Array.isArray(known) &&
      known.length === partial.length &&
      partial.every((v, i) => covers(known[i], v))
    );
  }
  if (typeof partial === 'object') {
    if (typeof known !== 'object' || known === null || Array.isArray(known)) return false;
    const k = known as Record<string, unknown>;
    const p = partial as Record<string, unknown>;
    return Object.keys(p).every((key) => covers(k[key], p[key]));
  }
  return known === partial;
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
  // Inconnu ≠ 0: an ok event is completed by a reading that only fills its unknown values
  const refines = existing.status === 'ok' && !same && covers(result.event, existing.data);
  const replace =
    existing.status === 'unrecognized' ||
    refines ||
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
  if (covers(existing.data, result.event)) return 'kept';
  await trx
    .updateTable('events')
    .set({ status: 'conflict' })
    .where('id', '=', existing.id)
    .execute();
  return 'new_conflict';
}
