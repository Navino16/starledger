import { API_VERSION } from '@app/shared';
import type { FastifyInstance } from 'fastify';

export async function pingRoutes(app: FastifyInstance) {
  app.get('/ping', async (request) => ({
    ok: true,
    // apiUser is set by the auth hook that runs before every API route.
    username: (request.apiUser as { username: string }).username,
    apiVersion: API_VERSION,
  }));
}
