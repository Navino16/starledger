import { API_VERSION } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { requireApiUser } from './errors';

export async function pingRoutes(app: FastifyInstance) {
  app.get('/ping', async (request) => ({
    ok: true,
    username: requireApiUser(request).username,
    apiVersion: API_VERSION,
  }));
}
