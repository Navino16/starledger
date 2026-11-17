import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { callsTo, renderAt, sessionReply } from './helpers';

const VEGA = { username: 'vega', isAdmin: false, locale: 'fr' as const };

describe('login', () => {
  it('shows an alert on invalid credentials', async () => {
    renderAt('/login', { 'POST /login': [401, { error: 'invalid_credentials' }] });
    await userEvent.type(await screen.findByLabelText('Identifiant'), 'vega');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Identifiants invalides');
  });

  it('signs in, reloads the session and goes to /dashboard', async () => {
    let signedIn = false;
    const { router, fetch } = renderAt('/login', {
      'GET /session': () => sessionReply({ user: signedIn ? VEGA : null }),
      'POST /login': (body) => {
        signedIn = true;
        expect(body).toEqual({ username: 'vega', password: 'correct horse battery' });
        return [200, { user: VEGA }];
      },
    });
    await userEvent.type(await screen.findByLabelText('Identifiant'), 'vega');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(callsTo(fetch, 'GET /session')).toHaveLength(2);
  });

  it('sends a signed-in user straight to /dashboard', async () => {
    const { router } = renderAt('/login', { 'GET /session': sessionReply({ user: VEGA }) });
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});

describe('signup from an invitation', () => {
  it('shows the error page for an expired invitation', async () => {
    renderAt('/invite/old', { 'GET /invitations/old': [410, { error: 'invitation_invalid' }] });
    expect(await screen.findByText(/invitation n'est plus valide/)).toBeInTheDocument();
  });

  it('puts server errors under the matching field', async () => {
    renderAt('/invite/tok', {
      'GET /invitations/tok': [204],
      'POST /invitations/tok': [400, { error: 'username_taken' }],
    });
    await userEvent.type(await screen.findByLabelText('Identifiant'), 'orion');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));
    expect(await screen.findByText('Cet identifiant est déjà pris.')).toBeInTheDocument();
    expect(screen.getByLabelText('Identifiant')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription(
      '12 caractères minimum',
    );
  });

  it('switches to the error page when the invitation is used meanwhile', async () => {
    renderAt('/invite/tok', {
      'GET /invitations/tok': [204],
      'POST /invitations/tok': [410, { error: 'invitation_invalid' }],
    });
    await userEvent.type(await screen.findByLabelText('Identifiant'), 'orion');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));
    expect(await screen.findByText(/invitation n'est plus valide/)).toBeInTheDocument();
  });
});

describe('open signup', () => {
  it('is not found when OPEN_SIGNUP is off', async () => {
    renderAt('/signup', {});
    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument();
  });

  it('shows the form with a link to sign in when it is on', async () => {
    renderAt('/signup', { 'GET /session': sessionReply({ openSignup: true }) });
    expect(await screen.findByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/login');
  });
});

describe('password reset', () => {
  it('names the account and sends the new password', async () => {
    let sent: unknown;
    const { router } = renderAt('/reset/tok', {
      'GET /session': () => sessionReply({ user: sent ? VEGA : null }),
      'GET /password-resets/tok': [200, { username: 'vega' }],
      'POST /password-resets/tok': (body) => {
        sent = body;
        return [200, { user: VEGA }];
      },
      'GET /accounts': [200, { accounts: [] }],
    });
    expect(await screen.findByText('Compte : vega')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'another long password');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
    expect(await screen.findByText(/se remplit une fois/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(sent).toEqual({ password: 'another long password' });
  });

  it('shows a too short password under the field', async () => {
    renderAt('/reset/tok', {
      'GET /password-resets/tok': [200, { username: 'vega' }],
      'POST /password-resets/tok': [400, { error: 'password_short' }],
    });
    await userEvent.type(await screen.findByLabelText('Nouveau mot de passe'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
    expect(
      await screen.findByText('Le mot de passe doit contenir au moins 12 caractères.'),
    ).toBeInTheDocument();
  });

  it('shows the error page for a used link', async () => {
    renderAt('/reset/old', { 'GET /password-resets/old': [410, { error: 'reset_invalid' }] });
    expect(await screen.findByText(/lien n'est plus valide/)).toBeInTheDocument();
  });

  it('shows a rate limit as an alert', async () => {
    renderAt('/reset/tok', {
      'GET /password-resets/tok': [200, { username: 'vega' }],
      'POST /password-resets/tok': [429, { error: 'rate_limited' }],
    });
    await userEvent.type(
      await screen.findByLabelText('Nouveau mot de passe'),
      'another long password',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives');
  });
});
