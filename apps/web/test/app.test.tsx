import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderAt } from './helpers';

describe('App', () => {
  it('shows the not found page on an unknown path', async () => {
    renderAt('/nope', {});
    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connexion' })).toHaveAttribute('href', '/login');
  });

  it('shows an error page when the server does not answer', async () => {
    renderAt('/login', { 'GET /session': [500, { error: 'server_error' }] });
    expect(
      await screen.findByText(/serveur ne répond pas|server is not responding/),
    ).toBeInTheDocument();
  });
});
