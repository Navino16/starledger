import { useState } from 'react';
import { createBrowserRouter, Outlet, type RouteObject, RouterProvider } from 'react-router';
import { ErrorPage, NotFoundPage } from './pages/error';
import { LoginPage } from './pages/login';
import { ResetPasswordPage } from './pages/reset-password';
import { InvitePage, OpenSignupPage } from './pages/signup';
import { SessionProvider, useSession } from './session';

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
