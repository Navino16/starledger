import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import type { Locale } from './i18n';

declare module '@fastify/secure-session' {
  interface SessionData {
    userId: string;
    // Absent from cookies issued before migration 0004, read as version 0.
    sessionVersion?: number;
  }
}

export interface WebUser {
  id: string;
  username: string;
  isAdmin: boolean;
  locale: Locale;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: WebUser | null;
  }
}

export function startSession(request: FastifyRequest, userId: string, sessionVersion: number) {
  request.session.regenerate();
  request.session.set('userId', userId);
  request.session.set('sessionVersion', sessionVersion);
}

// Reloads the session user on every request so deletions, role and locale changes apply immediately.
export function loadUser(db: Kysely<Database>) {
  return async (request: FastifyRequest) => {
    const id = request.session.get('userId');
    if (!id) return;
    const row = await db
      .selectFrom('users')
      .select(['id', 'username', 'is_admin', 'locale', 'session_version'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row || (request.session.get('sessionVersion') ?? 0) !== row.session_version) {
      request.session.delete();
      return;
    }
    request.user = {
      id: row.id,
      username: row.username,
      isAdmin: row.is_admin,
      locale: row.locale,
    };
  };
}

export const requireUser: preHandlerAsyncHookHandler = async (request, reply) => {
  if (!request.user) return reply.redirect('/login');
};

export const requireAdmin: preHandlerAsyncHookHandler = async (request) => {
  if (!request.user?.isAdmin) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
};
