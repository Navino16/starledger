import { ARTEFACTS_IMAGE, RESOURCE_SPRITE } from '@app/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { callsTo, type Handler, renderAt, sessionReply, statsReply } from './helpers';

const VEGA = { username: 'vega', isAdmin: false, locale: 'fr' as const };
const ACCOUNTS = [
  { serverId: 172, lang: 'en', playerId: 9, playerName: null },
  { serverId: 285, lang: 'fr', playerId: 7, playerName: 'Vega' },
];

const open = (path: string, handlers: Record<string, Handler> = {}) =>
  renderAt(path, {
    'GET /session': sessionReply({ user: VEGA }),
    'GET /accounts': [200, { accounts: ACCOUNTS }],
    'GET /stats': [200, statsReply()],
    ...handlers,
  });

const search = (router: { state: { location: { search: string } } }) =>
  new URLSearchParams(router.state.location.search);

describe('dashboard', () => {
  it('is where a signed-in user lands, first tab of the menu', async () => {
    const { router } = open('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    const nav = await screen.findByRole('navigation', { name: 'Menu principal' });
    const tabs = within(nav).getAllByRole('link');
    expect(tabs[0]).toHaveTextContent('Dashboard');
    expect(tabs[0]).toHaveAttribute('aria-current', 'page');
  });

  it('picks the first account and puts it in the URL', async () => {
    const { router, fetch } = open('/dashboard?day=2026-11-17');
    await waitFor(() => expect(search(router).get('account')).toBe('172-en-9'));
    await waitFor(() =>
      expect(
        callsTo(fetch, 'GET /stats?serverId=172&lang=en&playerId=9&period=month&today=2026-11-17'),
      ).toHaveLength(1),
    );
    expect(await screen.findByRole('heading', { name: 'Novembre 2026' })).toBeInTheDocument();
  });

  it('falls back to the first account for an unknown one', async () => {
    const { router } = open('/dashboard?account=999-fr-1');
    await waitFor(() => expect(search(router).get('account')).toBe('172-en-9'));
  });

  it('loads the account chosen in the selector', async () => {
    const { router, fetch } = open('/dashboard?day=2026-11-17');
    const select = await screen.findByLabelText('Compte suivi');
    expect(
      within(select).getByRole('option', { name: 'Univers 172 (en) · Joueur 9' }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(select, '285-fr-7');
    await waitFor(() => expect(search(router).get('account')).toBe('285-fr-7'));
    await waitFor(() =>
      expect(
        callsTo(fetch, 'GET /stats?serverId=285&lang=fr&playerId=7&period=month&today=2026-11-17'),
      ).toHaveLength(1),
    );
  });

  it('keeps the latest selection when an older answer arrives late', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { fetch } = open('/dashboard?day=2026-11-17', {
      'GET /stats': () => [
        200,
        statsReply((s) => {
          s.summary.tiles.metal = 2_000_000;
        }),
      ],
    });
    const original = fetch.getMockImplementation();
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const res = await original?.(url, init);
      if (String(url).includes('serverId=172')) {
        await gate;
        return new Response(
          JSON.stringify(
            statsReply((s) => {
              s.summary.tiles.metal = 1_000_000;
            }),
          ),
          { status: 200 },
        );
      }
      return res as Response;
    });
    await userEvent.selectOptions(await screen.findByLabelText('Compte suivi'), '285-fr-7');
    expect(await screen.findByText('2 M')).toBeInTheDocument();
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByText('2 M')).toBeInTheDocument();
    expect(screen.queryByText('1 M')).not.toBeInTheDocument();
  });

  it('moves to the previous month', async () => {
    const { router } = open('/dashboard?account=285-fr-7&period=month&day=2026-11-17');
    await userEvent.click(await screen.findByRole('button', { name: 'Période précédente' }));
    await waitFor(() => expect(search(router).get('day')).toBe('2026-10-17'));
    expect(await screen.findByRole('heading', { name: 'Octobre 2026' })).toBeInTheDocument();
  });

  it('switches period with the segment buttons', async () => {
    const { router } = open('/dashboard?account=285-fr-7&day=2026-11-17');
    await userEvent.click(await screen.findByRole('button', { name: 'Semaine' }));
    await waitFor(() => expect(search(router).get('period')).toBe('week'));
    expect(screen.getByRole('button', { name: 'Semaine' })).toHaveAttribute('aria-pressed', 'true');
    expect(
      await screen.findByRole('heading', { name: 'Semaine du 16 nov. 2026' }),
    ).toBeInTheDocument();
  });

  it('explains an empty dashboard and asks for no stats', async () => {
    const { fetch } = open('/dashboard', { 'GET /accounts': [200, { accounts: [] }] });
    expect(await screen.findByText(/se remplit une fois que le userscript/)).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/stats'))).toBe(false);
  });

  it('shows the key figures and the unknown fuel departures', async () => {
    open('/dashboard?account=285-fr-7', {
      'GET /stats': [
        200,
        statsReply((s) => {
          s.summary.tiles.msu = 30_612_345;
          s.summary.fuel = { recorded: 120_000, departures: 5, unknownCount: 3 };
        }),
      ],
    });
    expect(await screen.findByText('+30,6 M')).toBeInTheDocument();
    expect(screen.getByText('+ 3 départs inconnus')).toBeInTheDocument();
    expect(screen.getByText('Données partielles').closest('p')).toHaveTextContent(
      '3 départs au carburant inconnu',
    );
  });

  it('says nothing about partial data when everything is known', async () => {
    open('/dashboard?account=285-fr-7');
    await screen.findByText('Bilan MSU');
    expect(screen.queryByText(/Données partielles/)).not.toBeInTheDocument();
  });

  it('says unrecognized reports cover the whole history', async () => {
    open('/dashboard?account=285-fr-7', {
      'GET /stats': [
        200,
        statsReply((s) => {
          s.counts.unrecognized = 4;
        }),
      ],
    });
    expect((await screen.findByText('Données partielles')).closest('p')).toHaveTextContent(
      "4 rapports non reconnus dans tout l'historique",
    );
  });

  it('shows a player name as text', async () => {
    open('/dashboard', {
      'GET /accounts': [
        200,
        { accounts: [{ serverId: 1, lang: 'fr', playerId: 2, playerName: '<b>x</b>' }] },
      ],
    });
    expect(
      await screen.findByRole('option', { name: 'Univers 1 (fr) · <b>x</b>' }),
    ).toBeInTheDocument();
  });

  it('shows the game icon of each resource', async () => {
    open('/dashboard?account=285-fr-7');
    const metal = (await screen.findByText('Métal')).closest('div') as HTMLElement;
    const artefacts = screen.getByText('Artefacts').closest('div') as HTMLElement;
    expect(metal.querySelector('[aria-hidden="true"]')?.getAttribute('style')).toContain(
      RESOURCE_SPRITE,
    );
    expect(artefacts.querySelector('[aria-hidden="true"]')?.getAttribute('style')).toContain(
      ARTEFACTS_IMAGE,
    );
  });
});
