import {
  computeStats,
  DEFAULT_VALUATION,
  type SiteLocale,
  type SiteUser,
  type StatsResponse,
} from '@app/shared';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../src/app';
import { type Session, SessionContext, SessionProvider } from '../src/session';

export type Reply = [status: number, body?: unknown];
export type Handler = Reply | ((body: unknown) => Reply);

export interface SessionFixture {
  user?: SiteUser | null;
  locale?: SiteLocale;
  openSignup?: boolean;
}

export const sessionReply = (fixture: SessionFixture = {}): Reply => [
  200,
  {
    user: fixture.user ?? null,
    locale: fixture.locale ?? 'fr',
    csrfToken: 'csrf-token',
    openSignup: fixture.openSignup ?? false,
  },
];

/** Stubs fetch with one reply per "METHOD /path" under /api/site (the query string may be left out); unknown calls answer 404. */
export function mockApi(handlers: Record<string, Handler>) {
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${url.replace(/^\/api\/site/, '')}`;
    const handler = handlers[key] ?? handlers[key.split('?')[0] as string];
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const [status, payload] = handler
      ? typeof handler === 'function'
        ? handler(body)
        : handler
      : [404, { error: 'not_found' }];
    return new Response(payload === undefined ? null : JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** Renders the real routes at a path, with the session loaded from the mocked API. */
export function renderAt(path: string, handlers: Record<string, Handler>) {
  const fetch = mockApi({ 'GET /session': sessionReply(), ...handlers });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return { ...view, router, fetch };
}

export function withSession(ui: ReactNode, fixture: SessionFixture = {}) {
  const session: Session = {
    user: fixture.user ?? null,
    locale: fixture.locale ?? 'fr',
    openSignup: fixture.openSignup ?? false,
    unavailable: false,
    refresh: async () => {},
  };
  return render(<SessionContext.Provider value={session}>{ui}</SessionContext.Provider>);
}

export const callsTo = (fetch: ReturnType<typeof mockApi>, key: string) =>
  fetch.mock.calls.filter(
    ([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace(/^\/api\/site/, '')}` === key,
  );

/** An empty month of stats, adjusted by `patch`. */
export function statsReply(patch: (s: StatsResponse) => void = () => {}): StatsResponse {
  const stats: StatsResponse = {
    period: 'month',
    range: { from: '2026-11-01', to: '2026-11-30' },
    generatedAt: 0,
    summary: computeStats([], DEFAULT_VALUATION),
    days: [],
    counts: { unrecognized: 0 },
    settings: DEFAULT_VALUATION,
  };
  patch(stats);
  return stats;
}
