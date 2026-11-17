import { type SiteLocale, type SiteUser, sessionResponseSchema } from '@app/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setCsrfToken } from './api';

export interface Session {
  user: SiteUser | null;
  locale: SiteLocale;
  openSignup: boolean;
  /** The first GET /session failed: the app shows an error page instead of its routes. */
  unavailable: boolean;
  refresh: () => Promise<void>;
}

export const SessionContext = createContext<Session | null>(null);

const browserLocale = (): SiteLocale =>
  navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Session, 'refresh'> | null>(null);

  const refresh = useCallback(async () => {
    const session = await apiFetch('/session', { schema: sessionResponseSchema });
    setCsrfToken(session.csrfToken);
    setState({
      user: session.user,
      locale: session.locale,
      openSignup: session.openSignup,
      unavailable: false,
    });
  }, []);

  useEffect(() => {
    refresh().catch(() =>
      setState({ user: null, locale: browserLocale(), openSignup: false, unavailable: true }),
    );
  }, [refresh]);

  useEffect(() => {
    if (state) document.documentElement.lang = state.locale;
  }, [state]);

  if (!state) return null;
  return (
    <SessionContext.Provider value={{ ...state, refresh }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession needs a SessionProvider');
  return session;
}
