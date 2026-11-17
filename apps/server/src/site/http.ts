import type { SiteErrorCode, SiteUser } from '@app/shared';
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { ZodType } from 'zod';
import type { User } from '../users/users';
import type { WebUser } from './session';

export class SiteBodyError extends Error {}

export const sendSiteError = (reply: FastifyReply, status: number, error: SiteErrorCode) =>
  reply.status(status).send({ error });

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new SiteBodyError(parsed.error.message);
  return parsed.data;
}

export const toSiteUser = (user: WebUser | User): SiteUser => ({
  username: user.username,
  isAdmin: user.isAdmin,
  locale: user.locale,
});

export const currentUser = (request: FastifyRequest) => request.user as WebUser;

export const requireSiteUser: preHandlerAsyncHookHandler = async (request, reply) => {
  if (!request.user) return sendSiteError(reply, 401, 'unauthenticated');
};

export const requireSiteAdmin: preHandlerAsyncHookHandler = async (request, reply) => {
  if (!request.user) return sendSiteError(reply, 401, 'unauthenticated');
  if (!request.user.isAdmin) return sendSiteError(reply, 403, 'forbidden');
};

// Secrets shown once (keys, invitation and reset links) must not be cached.
export const noStore = (reply: FastifyReply) => reply.header('Cache-Control', 'no-store');

export const LOGIN_MAX_PER_MINUTE = 10;
export const perMinute = (max: number) => ({
  config: { rateLimit: { max, timeWindow: '1 minute' } },
});
