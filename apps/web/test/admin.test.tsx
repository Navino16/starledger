import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { type Handler, renderAt, sessionReply } from './helpers';

const ADMIN = { username: 'orion', isAdmin: true, locale: 'fr' as const };

const asAdmin = (handlers: Record<string, Handler>) =>
  renderAt('/admin', { 'GET /session': sessionReply({ user: ADMIN }), ...handlers });

describe('admin page', () => {
  it('shows a created invitation link', async () => {
    asAdmin({ 'POST /admin/invitations': [201, { url: 'https://sl.test/invite/abc' }] });
    await userEvent.click(await screen.findByRole('button', { name: 'Créer une invitation' }));
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('valable 72 heures');
    expect(notice).toHaveTextContent('https://sl.test/invite/abc');
  });

  it('names the account in the reset link message', async () => {
    let sent: unknown;
    asAdmin({
      'POST /admin/password-resets': (body) => {
        sent = body;
        return [201, { url: 'https://sl.test/reset/xyz', username: 'vega' }];
      },
    });
    await userEvent.type(await screen.findByLabelText('Identifiant Starledger'), 'Vega');
    await userEvent.click(screen.getByRole('button', { name: 'Créer un lien' }));
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Lien de réinitialisation créé pour vega.');
    expect(notice).toHaveTextContent('https://sl.test/reset/xyz');
    expect(sent).toEqual({ username: 'Vega' });
  });

  it('puts an unknown username under the field', async () => {
    asAdmin({ 'POST /admin/password-resets': [404, { error: 'unknown_user' }] });
    await userEvent.type(await screen.findByLabelText('Identifiant Starledger'), 'nobody');
    await userEvent.click(screen.getByRole('button', { name: 'Créer un lien' }));
    expect(await screen.findByText('Aucun compte avec cet identifiant')).toBeInTheDocument();
    expect(screen.getByLabelText('Identifiant Starledger')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows other failures as an alert', async () => {
    asAdmin({ 'POST /admin/invitations': [429, { error: 'rate_limited' }] });
    await userEvent.click(await screen.findByRole('button', { name: 'Créer une invitation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives');
  });

  it('shows the error page to a player', async () => {
    renderAt('/admin', {
      'GET /session': sessionReply({ user: { ...ADMIN, username: 'vega', isAdmin: false } }),
    });
    expect(await screen.findByText("Vous n'avez pas accès à cette page.")).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
