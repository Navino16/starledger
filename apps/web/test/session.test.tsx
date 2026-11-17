import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RequireAdmin, RequireUser } from '../src/guards';
import { SessionProvider } from '../src/session';
import { mockApi, sessionReply } from './helpers';

function renderGuarded(element: React.ReactNode) {
  const router = createMemoryRouter(
    [
      { path: '/private', element },
      { path: '/login', element: <p>login page</p> },
    ],
    { initialEntries: ['/private'] },
  );
  render(
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  return router;
}

describe('guards', () => {
  it('send visitors to /login', async () => {
    mockApi({ 'GET /session': sessionReply() });
    const router = renderGuarded(
      <RequireUser>
        <p>secret</p>
      </RequireUser>,
    );
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('let a signed-in user through and set the page language', async () => {
    mockApi({
      'GET /session': sessionReply({
        user: { username: 'vega', isAdmin: false, locale: 'en' },
        locale: 'en',
      }),
    });
    renderGuarded(
      <RequireUser>
        <p>secret</p>
      </RequireUser>,
    );
    expect(await screen.findByText('secret')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('show the forbidden page to a non-admin', async () => {
    mockApi({
      'GET /session': sessionReply({ user: { username: 'vega', isAdmin: false, locale: 'fr' } }),
    });
    renderGuarded(
      <RequireAdmin>
        <p>admin only</p>
      </RequireAdmin>,
    );
    expect(await screen.findByText("Vous n'avez pas accès à cette page.")).toBeInTheDocument();
    expect(screen.queryByText('admin only')).not.toBeInTheDocument();
  });
});
