import type { ApiError } from '@app/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface ApiUser {
  userId: string;
  username: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiUser: ApiUser | null;
  }
}

export function sendError(reply: FastifyReply, status: number, error: ApiError, message: string) {
  return reply.status(status).send({ error, message });
}

// The auth hook rejects anonymous requests first, so a null user here is a wiring bug.
export function requireApiUser(request: FastifyRequest): ApiUser {
  if (!request.apiUser) throw new Error('API route reached without an authenticated user');
  return request.apiUser;
}
