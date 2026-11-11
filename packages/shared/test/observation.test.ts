import { describe, expect, it } from 'vitest';
import { accountRefSchema } from '../src/domain';
import {
  MAX_BATCH,
  MAX_TIMESTAMP_MS,
  observationBatchEnvelopeSchema,
  observationBatchSchema,
  observationSchema,
} from '../src/observation';

const account = { serverId: 808, lang: 'en', playerId: 1, playerName: null };
const uuid = '123e4567-e89b-42d3-a456-426614174000';

const message = (over: Record<string, unknown> = {}) => ({
  kind: 'message',
  clientObservationId: uuid,
  account,
  observedAt: 1_700_000_000_000,
  serverUtcOffsetMinutes: 60,
  msgId: 42,
  messageType: null,
  subtabId: null,
  raw: {},
  ...over,
});

const dispatch = (over: Record<string, unknown> = {}) => ({
  kind: 'fleet_dispatch',
  clientObservationId: uuid,
  account,
  observedAt: 1_700_000_000_000,
  serverUtcOffsetMinutes: 60,
  source: 'fleetdispatch',
  mission: 15,
  origin: null,
  target: { galaxy: 1, system: 2, position: 16, type: 1 },
  ships: { '210': 3 },
  consumption: null,
  sentAt: 1_700_000_000_000,
  ...over,
});

const batch = (observations: unknown[]) => ({
  clientVersion: '0.1.0',
  deviceId: '5b1f0c3e-7a4d-4e21-9d6a-0c8f3b2a1e11',
  observations,
});

describe('observationSchema', () => {
  it('accepts a minimal message observation', () => {
    expect(observationSchema.safeParse(message()).success).toBe(true);
  });

  it('accepts a fleet_dispatch with null consumption', () => {
    expect(observationSchema.safeParse(dispatch()).success).toBe(true);
  });

  it('rejects a negative consumption', () => {
    expect(observationSchema.safeParse(dispatch({ consumption: -1 })).success).toBe(false);
  });

  it('rejects a non-UUID clientObservationId', () => {
    expect(observationSchema.safeParse(message({ clientObservationId: 'nope' })).success).toBe(
      false,
    );
  });

  it('rejects a UTC offset of 900 minutes', () => {
    expect(observationSchema.safeParse(message({ serverUtcOffsetMinutes: 900 })).success).toBe(
      false,
    );
  });

  it('rejects raw with more than 64 keys', () => {
    const raw = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, 'v']));
    expect(observationSchema.safeParse(message({ raw })).success).toBe(false);
    const ok = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`k${i}`, 'v']));
    expect(observationSchema.safeParse(message({ raw: ok })).success).toBe(true);
  });

  it('rejects a raw value longer than 64000 characters', () => {
    expect(observationSchema.safeParse(message({ raw: { a: 'x'.repeat(64_001) } })).success).toBe(
      false,
    );
    expect(observationSchema.safeParse(message({ raw: { a: 'x'.repeat(64_000) } })).success).toBe(
      true,
    );
  });
});

describe('timestamp bounds', () => {
  it('accepts the largest valid Date and rejects beyond it', () => {
    expect(observationSchema.safeParse(message({ observedAt: MAX_TIMESTAMP_MS })).success).toBe(
      true,
    );
    expect(observationSchema.safeParse(message({ observedAt: MAX_TIMESTAMP_MS + 2 })).success).toBe(
      false,
    );
    expect(observationSchema.safeParse(dispatch({ sentAt: MAX_TIMESTAMP_MS })).success).toBe(true);
    expect(observationSchema.safeParse(dispatch({ sentAt: MAX_TIMESTAMP_MS + 2 })).success).toBe(
      false,
    );
  });
});

describe('envelope clientVersion', () => {
  const env = (clientVersion: string) =>
    observationBatchEnvelopeSchema.safeParse({ ...batch([]), clientVersion }).success;

  it('accepts strict MAJOR.MINOR.PATCH only', () => {
    expect(env('1.22.3')).toBe(true);
    for (const bad of ['', '1.2', '0.1.0\0', '1.0.0-beta', 'v1.0.0', '1.0.0 ']) {
      expect(env(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('observationBatchSchema', () => {
  it('accepts up to MAX_BATCH observations', () => {
    const obs = Array.from({ length: MAX_BATCH }, () => message());
    expect(observationBatchSchema.safeParse(batch(obs)).success).toBe(true);
  });

  it('rejects more than MAX_BATCH observations', () => {
    const obs = Array.from({ length: MAX_BATCH + 1 }, () => message());
    expect(observationBatchSchema.safeParse(batch(obs)).success).toBe(false);
  });

  it('rejects a batch containing an invalid observation', () => {
    expect(
      observationBatchSchema.safeParse(batch([message({ clientObservationId: 'x' })])).success,
    ).toBe(false);
  });
});

describe('accountRefSchema bounds', () => {
  const ref = (over: Record<string, unknown>) =>
    accountRefSchema.safeParse({ ...account, ...over }).success;

  it('accepts a normal reference', () => {
    expect(ref({})).toBe(true);
    expect(ref({ playerId: 0 })).toBe(true);
    expect(ref({ serverId: 2_147_483_647, lang: 'fra' })).toBe(true);
  });

  it.each([
    ['int4 overflow', { serverId: 2_147_483_648 }],
    ['zero server id', { serverId: 0 }],
    ['negative player id', { playerId: -1 }],
    ['NUL in lang', { lang: '\0' }],
    ['uppercase lang', { lang: 'EN' }],
    ['regional lang', { lang: 'pt-br' }],
  ])('rejects %s', (_name, over) => {
    expect(ref(over)).toBe(false);
  });
});
