import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { callsTo, type Handler, renderAt, sessionReply } from './helpers';

const VEGA = { username: 'vega', isAdmin: false, locale: 'fr' as const };
const ADMIN = { ...VEGA, username: 'orion', isAdmin: true };

const PC = {
  id: 'k1',
  name: 'PC',
  prefix: 'slk_9f3a',
  createdAt: '2026-11-03T10:00:00.000Z',
  lastUsedAt: '2026-11-16T13:32:00.000Z',
};
const OLD = { ...PC, id: 'k2', name: null, prefix: 'slk_Qm7d', lastUsedAt: null };

const signedIn = (handlers: Record<string, Handler>, user = VEGA) =>
  renderAt('/account', { 'GET /session': sessionReply({ user }), ...handlers });

describe('account page', () => {
  it('lists the keys, with « Sans nom » and « jamais »', async () => {
    signedIn({ 'GET /api-keys': [200, { keys: [PC, OLD] }] });
    const table = await screen.findByRole('table', { name: 'Clés API actives' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('PC');
    expect(rows[1]).toHaveTextContent('slk_9f3a…');
    expect(rows[2]).toHaveTextContent('Sans nom');
    expect(rows[2]).toHaveTextContent('jamais');
  });

  it('shows a created key once and adds its row', async () => {
    let keys = [PC];
    signedIn({
      'GET /api-keys': () => [200, { keys }],
      'POST /api-keys': (body) => {
        expect(body).toEqual({ name: 'Téléphone' });
        keys = [{ ...PC, id: 'k3', name: 'Téléphone', prefix: 'slk_UJB4' }, ...keys];
        return [201, { id: 'k3', key: 'slk_secret' }];
      },
    });
    await userEvent.type(await screen.findByLabelText('Nom'), 'Téléphone');
    await userEvent.click(screen.getByRole('button', { name: 'Créer une clé' }));
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Clé créée');
    expect(notice).toHaveTextContent('slk_secret');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
    expect(screen.getByLabelText('Nom')).toHaveValue('');
  });

  it('puts an invalid name under the field', async () => {
    signedIn({
      'GET /api-keys': [200, { keys: [] }],
      'POST /api-keys': [400, { error: 'name_invalid' }],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Créer une clé' }));
    expect(
      await screen.findByText('Le nom doit contenir de 1 à 64 caractères.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true');
  });

  it('removes a revoked key', async () => {
    const { fetch } = signedIn({
      'GET /api-keys': [200, { keys: [PC, OLD] }],
      'DELETE /api-keys/k1': [204],
    });
    await screen.findByRole('table');
    const [revokeFirst] = screen.getAllByRole('button', { name: 'Révoquer' });
    await userEvent.click(revokeFirst as HTMLElement);
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    expect(screen.queryByText('PC')).not.toBeInTheDocument();
    expect(callsTo(fetch, 'DELETE /api-keys/k1')).toHaveLength(1);
  });

  it('says when there is no active key', async () => {
    signedIn({ 'GET /api-keys': [200, { keys: [] }] });
    expect(await screen.findByText('Aucune clé API active.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('alerts on a wrong current password', async () => {
    signedIn({
      'GET /api-keys': [200, { keys: [] }],
      'POST /password': [400, { error: 'current_invalid' }],
    });
    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'wrong');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'another long password');
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe actuel incorrect');
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveAttribute('aria-invalid', 'true');
  });

  it('confirms a password change and clears the fields', async () => {
    let sent: unknown;
    signedIn({
      'GET /api-keys': [200, { keys: [] }],
      'POST /password': (body) => {
        sent = body;
        return [204];
      },
    });
    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'old password!');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'another long password');
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Mot de passe changé');
    expect(sent).toEqual({ current: 'old password!', next: 'another long password' });
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveValue('');
  });

  it('puts a too short new password under its field', async () => {
    signedIn({
      'GET /api-keys': [200, { keys: [] }],
      'POST /password': [400, { error: 'password_short' }],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Changer le mot de passe' }));
    expect(
      await screen.findByText('Le mot de passe doit contenir au moins 12 caractères.'),
    ).toBeInTheDocument();
  });

  it('shows a load failure as an alert', async () => {
    signedIn({ 'GET /api-keys': [500, { error: 'server_error' }] });
    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue');
  });
});

describe('header', () => {
  it('marks the current tab and hides Administration from a player', async () => {
    signedIn({ 'GET /api-keys': [200, { keys: [] }] });
    const nav = await screen.findByRole('navigation', { name: 'Menu principal' });
    expect(within(nav).getByRole('link', { name: 'Compte' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
    expect(screen.getByText('vega')).toBeInTheDocument();
  });

  it('shows Administration to an admin', async () => {
    signedIn({ 'GET /api-keys': [200, { keys: [] }] }, ADMIN);
    const nav = await screen.findByRole('navigation', { name: 'Menu principal' });
    expect(within(nav).getByRole('link', { name: 'Administration' })).toHaveAttribute(
      'href',
      '/admin',
    );
  });

  it('signs out and goes to /login', async () => {
    let session = VEGA as typeof VEGA | null;
    const { router, fetch } = renderAt('/account', {
      'GET /session': () => sessionReply({ user: session }),
      'GET /api-keys': [200, { keys: [] }],
      'POST /logout': () => {
        session = null;
        return [204];
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Déconnexion' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(callsTo(fetch, 'POST /logout')).toHaveLength(1);
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });

  it('sends a visitor from / to /login', async () => {
    const { router } = renderAt('/', {});
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
