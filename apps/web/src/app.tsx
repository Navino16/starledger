import { useState } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  type RouteObject,
  RouterProvider,
} from 'react-router';
import { RequireAdmin, RequireUser } from './guards';
import { AccountPage } from './pages/account';
import { AdminPage } from './pages/admin';
import { ErrorPage, NotFoundPage } from './pages/error';
import { LoginPage } from './pages/login';
import { ResetPasswordPage } from './pages/reset-password';
import { SettingsPage } from './pages/settings';
import { InvitePage, OpenSignupPage } from './pages/signup';
import { SessionProvider, useSession } from './session';
import { AppShell } from './ui/app-shell';

function Root() {
  const { unavailable } = useSession();
  return unavailable ? <ErrorPage messageKey="errorPage.unavailable" /> : <Outlet />;
}

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <OpenSignupPage /> },
      { path: '/invite/:token', element: <InvitePage /> },
      { path: '/reset/:token', element: <ResetPasswordPage /> },
      { path: '/', element: <Navigate to="/account" replace /> },
      {
        element: (
          <RequireUser>
            <AppShell />
          </RequireUser>
        ),
        children: [
          { path: '/account', element: <AccountPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
      {
        element: (
          <RequireAdmin>
            <AppShell />
          </RequireAdmin>
        ),
        children: [{ path: '/admin', element: <AdminPage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function App() {
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  );
}
