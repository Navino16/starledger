import type { SiteLocale } from '@app/shared';
import type { FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

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
  locale: SiteLocale;
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

export function negotiateLocale(header: string | undefined): SiteLocale {
  const ranked = (header ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => /^\s*q=([\d.]+)/.exec(p)?.[1]).find(Boolean);
      return { lang: tag.trim().toLowerCase().split('-')[0], q: q === undefined ? 1 : Number(q) };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);
  const match = ranked.find((entry) => entry.lang === 'fr' || entry.lang === 'en');
  return match?.lang === 'fr' ? 'fr' : 'en';
}

export const localeOf = (request: FastifyRequest): SiteLocale =>
  request.user?.locale ?? negotiateLocale(request.headers['accept-language']);
