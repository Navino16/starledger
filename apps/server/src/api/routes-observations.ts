import { observationBatchEnvelopeSchema } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { ingestBatch } from '../ingest/ingest';
import { requireApiUser, sendError } from './errors';

export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function observationRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  app.post('/observations', { bodyLimit: MAX_BODY_BYTES }, async (request, reply) => {
    const envelope = observationBatchEnvelopeSchema.safeParse(request.body);
    if (!envelope.success) {
      return sendError(reply, 400, 'invalid_payload', envelope.error.message);
    }
    const { userId } = requireApiUser(request);
    return ingestBatch(opts.db, userId, envelope.data, request.log);
  });
}
