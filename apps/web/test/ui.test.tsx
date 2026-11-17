import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Alert } from '../src/ui/alert';
import { Field } from '../src/ui/field';
import { SecretNotice } from '../src/ui/notice';
import { withSession } from './helpers';

const SECRET = 'slk_secret';

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

describe('Field', () => {
  it('links the hint, or the error that replaces it', () => {
    const { rerender } = withSession(<Field label="Nom" hint="Une indication" />);
    const input = screen.getByLabelText('Nom');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription('Une indication');
    rerender(<Field label="Nom" hint="Une indication" error="Trop court" />);
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nom')).toHaveAccessibleDescription('Trop court');
    expect(screen.queryByText('Une indication')).not.toBeInTheDocument();
  });
});

describe('Alert', () => {
  it('is announced as an alert', () => {
    withSession(<Alert>Identifiants invalides</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Identifiants invalides');
  });
});

describe('SecretNotice', () => {
  it('has no copy button without the Clipboard API', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    withSession(<SecretNotice message="Clé créée" secret={SECRET} />);
    expect(screen.getByRole('status')).toHaveTextContent(SECRET);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('copies the secret and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    withSession(<SecretNotice message="Clé créée" secret={SECRET} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copier' }));
    expect(writeText).toHaveBeenCalledWith(SECRET);
    expect(await screen.findByRole('button', { name: 'Copié' })).toBeInTheDocument();
  });

  it('stays on « Copier » when the clipboard refuses', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    withSession(<SecretNotice message="Clé créée" secret={SECRET} />, { locale: 'fr' });
    await userEvent.click(screen.getByRole('button', { name: 'Copier' }));
    expect(screen.getByRole('button', { name: 'Copier' })).toBeInTheDocument();
    expect(screen.getByText(SECRET)).toBeInTheDocument();
  });
});
