import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { ErrorPage } from './pages/error';
import { useSession } from './session';

export function RequireUser({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return user ? children : <Navigate to="/login" replace />;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useSession();
  if (!user) return <Navigate to="/login" replace />;
  return user.isAdmin ? children : <ErrorPage messageKey="errorPage.forbidden" />;
}
