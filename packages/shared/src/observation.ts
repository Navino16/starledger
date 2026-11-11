import { z } from 'zod';
import { accountRefSchema, coordsSchema, shipCountsSchema } from './domain';

export const MAX_BATCH = 200;
const MAX_RAW_KEYS = 64;
const MAX_RAW_VALUE_LENGTH = 64_000;

const rawSchema = z
  .record(z.string(), z.string().max(MAX_RAW_VALUE_LENGTH))
  .refine((r) => Object.keys(r).length <= MAX_RAW_KEYS, {
    message: `raw has more than ${MAX_RAW_KEYS} keys`,
  });

const baseFields = {
  clientObservationId: z.uuid(),
  account: accountRefSchema,
  observedAt: z.number().int().nonnegative(),
  serverUtcOffsetMinutes: z.number().int().min(-720).max(840),
};

export const messageObservationSchema = z.object({
  kind: z.literal('message'),
  ...baseFields,
  msgId: z.number().int(),
  messageType: z.number().int().nullable(),
  subtabId: z.number().int().nullable(),
  raw: rawSchema,
});
export type MessageObservation = z.infer<typeof messageObservationSchema>;

export const fleetDispatchObservationSchema = z.object({
  kind: z.literal('fleet_dispatch'),
  ...baseFields,
  source: z.enum(['fleetdispatch', 'minifleet']),
  mission: z.number().int(),
  origin: coordsSchema.nullable(),
  target: coordsSchema.extend({ type: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  ships: shipCountsSchema,
  consumption: z.number().nonnegative().nullable(),
  sentAt: z.number().int().nonnegative(),
});
export type FleetDispatchObservation = z.infer<typeof fleetDispatchObservationSchema>;

export const observationSchema = z.discriminatedUnion('kind', [
  messageObservationSchema,
  fleetDispatchObservationSchema,
]);
export type Observation = z.infer<typeof observationSchema>;

export const observationBatchSchema = z.object({
  clientVersion: z.string(),
  deviceId: z.string(),
  observations: z.array(observationSchema).max(MAX_BATCH),
});
export type ObservationBatch = z.infer<typeof observationBatchSchema>;

export const ackStatusSchema = z.enum([
  'accepted',
  'duplicate',
  'conflict',
  'unrecognized',
  'rejected',
]);
export type AckStatus = z.infer<typeof ackStatusSchema>;

export type BatchAck = {
  results: { clientObservationId: string; status: AckStatus; reason?: string }[];
};
