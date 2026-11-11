import type { ApiError, BatchAck, Observation, ObservationBatch } from '@app/shared';
import type { Gm } from '../gm';
import { CLIENT_VERSION } from '../version';
import type { ApiResult } from './api';

export type SyncState = {
  status: 'up_to_date' | 'pending' | 'error';
  pending: number;
  lastSyncAt: number | null;
  error: ApiError | null;
  rejected: number;
};

export type QueueApi = {
  sendBatch(batch: ObservationBatch): Promise<ApiResult<BatchAck>>;
};

const QUEUE_KEY = 'queue';
const META_KEY = 'queueMeta';
const CAPACITY = 5000;
const BATCH_ITEMS = 100;
const BATCH_BYTES = 1_500_000;

type Meta = { rejected: number; lastSyncAt: number | null };

export function createQueue(gm: Gm) {
  let error: ApiError | null = null;
  let full = false;
  let inFlight: Promise<SyncState> | null = null;

  const read = () => gm.get<Observation[]>(QUEUE_KEY, []);
  const meta = () => gm.get<Meta>(META_KEY, { rejected: 0, lastSyncAt: null });

  function state(): SyncState {
    const { rejected, lastSyncAt } = meta();
    const pending = read().length;
    const status = error || full ? 'error' : pending > 0 ? 'pending' : 'up_to_date';
    return { status, pending, lastSyncAt, error, rejected };
  }

  function enqueue(observations: Observation[]) {
    const items = read();
    const room = Math.max(0, CAPACITY - items.length);
    const accepted = Math.min(room, observations.length);
    const refused = observations.length - accepted;
    if (accepted > 0) gm.set(QUEUE_KEY, [...items, ...observations.slice(0, accepted)]);
    if (refused > 0) full = true;
    return { accepted, refused };
  }

  // Removal always works on a fresh read: GM storage is shared across tabs
  function remove(ids: Set<string>, rejectedCount: number, synced: boolean) {
    if (ids.size > 0) {
      gm.set(
        QUEUE_KEY,
        read().filter((o) => !ids.has(o.clientObservationId)),
      );
    }
    const m = meta();
    gm.set(META_KEY, {
      rejected: m.rejected + rejectedCount,
      lastSyncAt: synced ? Date.now() : m.lastSyncAt,
    });
  }

  function takeBatch(maxItems: number): Observation[] {
    const batch: Observation[] = [];
    let bytes = 0;
    for (const o of read()) {
      if (batch.length >= maxItems) break;
      bytes += JSON.stringify(o).length + 1;
      if (batch.length > 0 && bytes > BATCH_BYTES) break;
      batch.push(o);
    }
    return batch;
  }

  async function drain(api: QueueApi, deviceId: string): Promise<SyncState> {
    error = null;
    let maxItems = BATCH_ITEMS;
    for (;;) {
      const batch = takeBatch(maxItems);
      const [first] = batch;
      if (!first) break;

      let result: ApiResult<BatchAck>;
      try {
        result = await api.sendBatch({
          clientVersion: CLIENT_VERSION,
          deviceId,
          observations: batch,
        });
      } catch {
        result = { ok: false, error: 'unreachable' };
      }

      if (!result.ok) {
        if (result.error !== 'payload_too_large') {
          error = result.error;
          break;
        }
        if (batch.length > 1) {
          maxItems = Math.ceil(batch.length / 2);
          continue;
        }
        // A single item the server can never accept would stall the queue forever
        remove(new Set([first.clientObservationId]), 1, false);
        continue;
      }

      const results = result.data?.results;
      if (!Array.isArray(results)) {
        error = 'server_error';
        break;
      }
      const sent = new Set(batch.map((o) => o.clientObservationId));
      const done = new Set<string>();
      let rejected = 0;
      for (const r of results) {
        if (!r || !sent.has(r.clientObservationId) || done.has(r.clientObservationId)) continue;
        done.add(r.clientObservationId);
        if (r.status === 'rejected') rejected++;
      }
      remove(done, rejected, true);
      if (done.size === 0) {
        error = 'server_error';
        break;
      }
    }
    return state();
  }

  function flush(api: QueueApi, deviceId: string): Promise<SyncState> {
    // One flush at a time (spec §5.5); a concurrent caller shares the in-flight one
    inFlight ??= drain(api, deviceId).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return { enqueue, size: () => read().length, state, flush };
}
