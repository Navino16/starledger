import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AckStatus, BatchAck, MessageObservation, ObservationBatch } from '@app/shared';
import { describe, expect, it } from 'vitest';
import { memoryGm } from '../src/gm';
import type { ApiResult } from '../src/sync/api';
import { createQueue } from '../src/sync/queue';

const obs = (n: number, raw: Record<string, string> = {}): MessageObservation => ({
  kind: 'message',
  clientObservationId: `id-${n}`,
  account: { serverId: 1, lang: 'fr', playerId: 1, playerName: null },
  observedAt: 1,
  serverUtcOffsetMinutes: 0,
  msgId: n,
  messageType: null,
  subtabId: null,
  raw,
});
const many = (count: number, start = 0) => Array.from({ length: count }, (_, i) => obs(start + i));
const ack = (batch: ObservationBatch, status: AckStatus = 'accepted'): ApiResult<BatchAck> => ({
  ok: true,
  data: {
    results: batch.observations.map((o) => ({
      clientObservationId: o.clientObservationId,
      status,
    })),
  },
});

describe('queue', () => {
  it('empties the queue after an ok flush', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(3));
    const state = await q.flush({ sendBatch: async (b) => ack(b) }, 'dev');
    expect(q.size()).toBe(0);
    expect(state).toMatchObject({ status: 'up_to_date', pending: 0, error: null });
    expect(state.lastSyncAt).not.toBeNull();
  });

  it('keeps everything when the server is unreachable', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(3));
    const state = await q.flush(
      { sendBatch: async () => ({ ok: false, error: 'unreachable' }) },
      'dev',
    );
    expect(q.size()).toBe(3);
    expect(state).toMatchObject({ status: 'error', pending: 3, error: 'unreachable' });
  });

  it('resends after a lost response and clears on duplicate acks', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(3));
    await q.flush(
      {
        sendBatch: async () => {
          throw new Error('response lost');
        },
      },
      'dev',
    );
    expect(q.size()).toBe(3);
    const state = await q.flush({ sendBatch: async (b) => ack(b, 'duplicate') }, 'dev');
    expect(q.size()).toBe(0);
    expect(state.status).toBe('up_to_date');
  });

  it('refuses new items beyond capacity without dropping old ones', () => {
    const q = createQueue(memoryGm());
    expect(q.enqueue(many(5000))).toEqual({ accepted: 5000, refused: 0 });
    expect(q.enqueue(many(2, 9000))).toEqual({ accepted: 0, refused: 2 });
    expect(q.size()).toBe(5000);
    expect(q.state().status).toBe('error');
  });

  it('shares one API call between concurrent flushes', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(3));
    let calls = 0;
    const api = {
      sendBatch: async (b: ObservationBatch) => {
        calls++;
        return ack(b);
      },
    };
    await Promise.all([q.flush(api, 'dev'), q.flush(api, 'dev')]);
    expect(calls).toBe(1);
  });

  it('drains every batch of at most 100 items in one flush', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(250));
    const sizes: number[] = [];
    await q.flush(
      {
        sendBatch: async (b) => {
          sizes.push(b.observations.length);
          return ack(b);
        },
      },
      'dev',
    );
    expect(sizes).toEqual([100, 100, 50]);
    expect(q.size()).toBe(0);
  });

  it('splits batches over 1.5 MB', async () => {
    const q = createQueue(memoryGm());
    const big = 'x'.repeat(700_000);
    q.enqueue([obs(1, { a: big }), obs(2, { a: big }), obs(3, { a: big })]);
    const sizes: number[] = [];
    await q.flush(
      {
        sendBatch: async (b) => {
          sizes.push(b.observations.length);
          return ack(b);
        },
      },
      'dev',
    );
    expect(sizes).toEqual([2, 1]);
  });

  it('halves a batch on payload_too_large and retries in the same flush', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(4));
    const sizes: number[] = [];
    const state = await q.flush(
      {
        sendBatch: async (b) => {
          sizes.push(b.observations.length);
          return b.observations.length > 2 ? { ok: false, error: 'payload_too_large' } : ack(b);
        },
      },
      'dev',
    );
    expect(sizes).toEqual([4, 2, 2]);
    expect(state.status).toBe('up_to_date');
  });

  it('drops and counts a single item that is too large', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(2));
    const state = await q.flush(
      {
        sendBatch: async (b) =>
          b.observations[0]?.clientObservationId === 'id-0'
            ? { ok: false, error: 'payload_too_large' }
            : ack(b),
      },
      'dev',
    );
    expect(q.size()).toBe(0);
    expect(state).toMatchObject({ status: 'up_to_date', rejected: 1 });
  });

  it('removes rejected items and counts them cumulatively', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(2));
    await q.flush({ sendBatch: async (b) => ack(b, 'rejected') }, 'dev');
    q.enqueue(many(1, 10));
    const state = await q.flush({ sendBatch: async (b) => ack(b, 'rejected') }, 'dev');
    expect(state.rejected).toBe(3);
    expect(q.size()).toBe(0);
  });

  it('does not lose an item enqueued while a flush awaits the API', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(2));
    const sent: string[][] = [];
    await q.flush(
      {
        sendBatch: async (b) => {
          sent.push(b.observations.map((o) => o.clientObservationId));
          if (sent.length === 1) q.enqueue([obs(99)]);
          return ack(b);
        },
      },
      'dev',
    );
    expect(sent).toEqual([['id-0', 'id-1'], ['id-99']]);
    expect(q.size()).toBe(0);
  });

  it('recovers from a full queue after a successful flush', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(5000));
    expect(q.state().status).toBe('error');
    const state = await q.flush({ sendBatch: async (b) => ack(b) }, 'dev');
    expect(state.status).toBe('up_to_date');
    expect(q.enqueue(many(1, 9000))).toEqual({ accepted: 1, refused: 0 });
  });

  it('restores full batch size after a halved batch succeeds', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(250));
    const sizes: number[] = [];
    await q.flush(
      {
        sendBatch: async (b) => {
          sizes.push(b.observations.length);
          return sizes.length === 1 ? { ok: false, error: 'payload_too_large' } : ack(b);
        },
      },
      'dev',
    );
    expect(sizes).toEqual([100, 50, 100, 100]);
  });

  it('keeps items acked with an unknown status', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(2));
    const state = await q.flush(
      {
        sendBatch: async (b) => ({
          ok: true,
          data: {
            results: b.observations.map((o) => ({
              clientObservationId: o.clientObservationId,
              status: 'weird' as unknown as AckStatus,
            })),
          },
        }),
      },
      'dev',
    );
    expect(q.size()).toBe(2);
    expect(state).toMatchObject({ status: 'error', error: 'server_error' });
  });

  it('keeps items on an empty results array', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(2));
    const state = await q.flush(
      { sendBatch: async () => ({ ok: true, data: { results: [] } }) },
      'dev',
    );
    expect(q.size()).toBe(2);
    expect(state).toMatchObject({ status: 'error', error: 'server_error' });
  });

  it('persists the rejected count across queue instances', async () => {
    const gm = memoryGm();
    const q1 = createQueue(gm);
    q1.enqueue(many(2));
    await q1.flush({ sendBatch: async (b) => ack(b, 'rejected') }, 'dev');
    expect(createQueue(gm).state().rejected).toBe(2);
  });

  it('keeps items missing from the ack and flags a server error', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(3));
    const state = await q.flush(
      {
        sendBatch: async (b) => ({
          ok: true,
          data: {
            results: b.observations
              .filter((o) => o.clientObservationId === 'id-0')
              .map((o) => ({
                clientObservationId: o.clientObservationId,
                status: 'accepted' as const,
              })),
          },
        }),
      },
      'dev',
    );
    expect(q.size()).toBe(2);
    expect(state).toMatchObject({ status: 'error', error: 'server_error', pending: 2 });
  });

  it('treats a malformed ack as a server error', async () => {
    const q = createQueue(memoryGm());
    q.enqueue(many(2));
    const state = await q.flush(
      { sendBatch: async () => ({ ok: true, data: { results: null } as unknown as BatchAck }) },
      'dev',
    );
    expect(q.size()).toBe(2);
    expect(state).toMatchObject({ status: 'error', error: 'server_error' });
  });

  it('persists the queue in GM storage', () => {
    const gm = memoryGm();
    createQueue(gm).enqueue(many(2));
    expect(createQueue(gm).size()).toBe(2);
  });

  it('contains no timer', () => {
    const src = readFileSync(join(process.cwd(), 'src/sync/queue.ts'), 'utf8');
    expect(src).not.toMatch(/setInterval|setTimeout/);
  });
});
