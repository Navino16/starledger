import type { FastifyRequest } from 'fastify';
import type { Locale } from './i18n';

declare module '@fastify/secure-session' {
  interface SessionData {
    userId: string;
    username: string;
    locale: Locale;
  }
}

export interface SessionUser {
  id: string;
  username: string;
  locale: Locale;
}

export function sessionUser(request: FastifyRequest): SessionUser | null {
  const id = request.session.get('userId');
  const username = request.session.get('username');
  const locale = request.session.get('locale');
  return id && username && locale ? { id, username, locale } : null;
}
