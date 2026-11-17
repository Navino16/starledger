import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { type Handler, renderAt, sessionReply } from './helpers';

const VEGA = { username: 'vega', isAdmin: false, locale: 'fr' as const };
const DEFAULTS = {
  msuRatio: [3, 2, 1],
  expeditionShipRatio: 100,
  anomalyShipRatio: 100,
  ignoreExpeShipsLoss: false,
  ignoreConsumption: false,
  includeTradesInBalance: true,
};
const U285 = { serverId: 285, lang: 'fr', settings: DEFAULTS };
const U172 = {
  serverId: 172,
  lang: 'en',
  settings: { ...DEFAULTS, msuRatio: [2.5, 1.5, 1], anomalyShipRatio: 50 },
};

const signedIn = (handlers: Record<string, Handler>) =>
  renderAt('/settings', { 'GET /session': sessionReply({ user: VEGA }), ...handlers });

const card = async (name: string) =>
  (await screen.findByRole('heading', { name })).closest('details') as HTMLDetailsElement;

describe('settings page', () => {
  it('opens the only universe', async () => {
    signedIn({ 'GET /settings': [200, { universes: [U285] }] });
    expect(await card('Univers 285 (fr)')).toHaveAttribute('open');
    expect(screen.getByLabelText('Métal')).toHaveValue(3);
  });

  it('starts with several universes closed, summarized in French', async () => {
    signedIn({ 'GET /settings': [200, { universes: [U285, U172] }] });
    const second = await card('Univers 172 (en)');
    expect(second).not.toHaveAttribute('open');
    expect(await card('Univers 285 (fr)')).not.toHaveAttribute('open');
    expect(
      within(second).getByText('MSU 2,5 : 1,5 : 1 · Expéditions 100 % · Anomalies 50 %'),
    ).toBeInTheDocument();
  });

  it('alerts on rejected settings and keeps the card open', async () => {
    signedIn({
      'GET /settings': [200, { universes: [U285, U172] }],
      'PUT /settings/172/en': [400, { error: 'settings_invalid' }],
    });
    const details = await card('Univers 172 (en)');
    await userEvent.click(within(details).getByText('Univers 172 (en)'));
    await waitFor(() => expect(details).toHaveAttribute('open'));
    const crystal = within(details).getByLabelText('Cristal');
    await userEvent.clear(crystal);
    await userEvent.type(crystal, '0');
    await userEvent.click(within(details).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(details).findByRole('alert')).toHaveTextContent('Réglages invalides');
    expect(details).toHaveAttribute('open');
    expect(crystal).toHaveAttribute('aria-invalid', 'true');
    expect(within(details).getByLabelText('Métal')).not.toHaveAttribute('aria-invalid');
  });

  it('saves and shows the new values in the summary', async () => {
    let sent: unknown;
    signedIn({
      'GET /settings': [200, { universes: [U285] }],
      'PUT /settings/285/fr': (body) => {
        sent = body;
        return [200, { settings: body }];
      },
    });
    const details = await card('Univers 285 (fr)');
    const anomaly = within(details).getByLabelText(
      "Vaisseaux des récompenses d'anomalie valorisés à (%)",
    );
    await userEvent.clear(anomaly);
    await userEvent.type(anomaly, '40');
    await userEvent.click(within(details).getByLabelText('Ignorer la consommation de carburant'));
    await userEvent.click(within(details).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(details).findByRole('status')).toHaveTextContent('Réglages enregistrés');
    expect(details).toHaveAttribute('open');
    expect(sent).toEqual({ ...DEFAULTS, anomalyShipRatio: 40, ignoreConsumption: true });
    expect(
      within(details).getByText('MSU 3 : 2 : 1 · Expéditions 100 % · Anomalies 40 %'),
    ).toBeInTheDocument();
  });

  it('sends an emptied field as null for the server to reject', async () => {
    let sent: { msuRatio?: unknown[] } = {};
    signedIn({
      'GET /settings': [200, { universes: [U285] }],
      'PUT /settings/285/fr': (body) => {
        sent = body as typeof sent;
        return [400, { error: 'settings_invalid' }];
      },
    });
    await userEvent.clear(await screen.findByLabelText('Métal'));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByRole('alert');
    expect(sent.msuRatio).toEqual([null, 2, 1]);
  });

  it('explains when no universe has data yet', async () => {
    signedIn({ 'GET /settings': [200, { universes: [] }] });
    expect(await screen.findByText(/apparaissent ici une fois/)).toBeInTheDocument();
  });
});
