import { createResetRequestSchema } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { Config } from '../config';
import type { Database } from '../db/schema';
import { createInvitation } from '../users/invitations';
import { createPasswordReset, UnknownUserError } from '../users/passwords';
import { currentUser, noStore, parseBody, requireSiteAdmin, sendSiteError } from './http';

export async function adminRoutes(
  app: FastifyInstance,
  opts: { db: Kysely<Database>; config: Config },
) {
  const { db, config } = opts;
  app.addHook('preHandler', requireSiteAdmin);

  app.post('/admin/invitations', async (request, reply) => {
    const { url } = await createInvitation(db, currentUser(request).id, config.publicUrl);
    return noStore(reply).status(201).send({ url });
  });

  app.post('/admin/password-resets', async (request, reply) => {
    const { username } = parseBody(createResetRequestSchema, request.body);
    try {
      const link = await createPasswordReset(
        db,
        currentUser(request).id,
        username,
        config.publicUrl,
      );
      return noStore(reply).status(201).send(link);
    } catch (error) {
      if (error instanceof UnknownUserError) return sendSiteError(reply, 404, 'unknown_user');
      throw error;
    }
  });
}
