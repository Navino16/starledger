import { observationBatchEnvelopeSchema } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { ingestBatch } from '../ingest/ingest';

export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function observationRoutes(app: FastifyInstance, opts: { db: Kysely<Database> }) {
  app.post('/observations', { bodyLimit: MAX_BODY_BYTES }, async (request, reply) => {
    const envelope = observationBatchEnvelopeSchema.safeParse(request.body);
    if (!envelope.success) {
      return reply.status(400).send({ error: 'invalid_payload', message: envelope.error.message });
    }
    // apiUser is set by the auth hook that runs before every API route.
    const { userId } = request.apiUser as { userId: string };
    return ingestBatch(opts.db, userId, envelope.data);
  });
}
