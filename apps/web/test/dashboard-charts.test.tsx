import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderAt, sessionReply, statsReply } from './helpers';

const VEGA = { username: 'vega', isAdmin: false, locale: 'fr' as const };
const ACCOUNT = { serverId: 285, lang: 'fr', playerId: 7, playerName: 'Vega' };

const month = (values: Record<number, number>) =>
  Array.from({ length: 30 }, (_, i) => ({
    day: `2026-11-${String(i + 1).padStart(2, '0')}`,
    msu: values[i + 1] ?? 0,
  }));

const open = (patch: Parameters<typeof statsReply>[0]) =>
  renderAt('/dashboard?account=285-fr-7&period=month&day=2026-11-17', {
    'GET /session': sessionReply({ user: VEGA }),
    'GET /accounts': [200, { accounts: [ACCOUNT] }],
    'GET /stats': [200, statsReply(patch)],
  });

const card = async (title: string) =>
  (await screen.findByRole('heading', { name: title })).closest('section') as HTMLElement;

describe('daily balance chart', () => {
  it('draws gains and losses and summarizes the month', async () => {
    open((s) => {
      s.days = month({ 3: -2_000_000, 5: 4_000_000, 6: 1_000_000 });
    });
    const section = await card('Bilan MSU par jour');
    const chart = within(section).getByRole('img');
    expect(chart).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Novembre 2026 : total 3\u00a0M MSU, 3 jours actifs'),
    );
    const fills = [...section.querySelectorAll('.recharts-bar-rectangle path')].map((p) =>
      p.getAttribute('fill'),
    );
    expect(fills).toContain('var(--color-danger)');
    expect(fills).toContain('var(--color-gain)');
    expect(within(section).getByText('+3 M')).toBeInTheDocument();
  });

  it('selects a day when its bar is clicked', async () => {
    const { router } = open((s) => {
      s.days = month({ 5: 4_000_000 });
    });
    const section = await card('Bilan MSU par jour');
    const bar = section.querySelector('path[data-day="2026-11-05"]');
    await userEvent.click(bar as Element);
    await waitFor(() => expect(router.state.location.search).toContain('period=day'));
    expect(router.state.location.search).toContain('day=2026-11-05');
  });

  it('says when the month has no activity', async () => {
    open((s) => {
      s.days = month({});
    });
    const section = await card('Bilan MSU par jour');
    expect(within(section).getByText('Aucune donnée sur cette période')).toBeInTheDocument();
    expect(within(section).queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('expedition results', () => {
  it('lists results by count with French percentages', async () => {
    open((s) => {
      Object.assign(s.summary.expeditions.outcomes, { resources: 412, nothing: 208, pirates: 330 });
    });
    const section = await card('Résultats des expéditions');
    const rows = within(section).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Ressources');
    expect(rows[0]).toHaveTextContent('43,4 %');
    expect(rows[1]).toHaveTextContent('Pirates');
    expect(within(section).getByText('950')).toBeInTheDocument();
  });

  it('says when there was no expedition', async () => {
    open(() => {});
    const section = await card('Résultats des expéditions');
    expect(within(section).getByText('Aucune donnée sur cette période')).toBeInTheDocument();
  });
});

const res = (metal: number, crystal = 0, deuterium = 0) => ({ metal, crystal, deuterium });

describe('balance by category', () => {
  it('shows one line per category with activity', async () => {
    open((s) => {
      s.summary.balance.expeditions = { gains: res(3_000_000), losses: res(0) };
      s.summary.balance.combats = { gains: res(0), losses: res(600_000) };
    });
    const section = await card('Gains et pertes par catégorie');
    const label = within(section).getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('Expéditions +3 M');
    expect(label).toContain('Combats +0 −600 k');
    expect(label).not.toContain('Recyclages');
    expect(label).not.toContain('Échanges');
  });

  it('adds trades when the universe counts them', async () => {
    open((s) => {
      s.settings = { ...s.settings, includeTradesInBalance: true };
      s.summary.trades.received = res(300_000);
    });
    const section = await card('Gains et pertes par catégorie');
    expect(within(section).getByRole('img')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Échanges +300 k'),
    );
  });

  it('leaves trades out otherwise', async () => {
    open((s) => {
      s.summary.trades.received = res(300_000);
    });
    const section = await card('Gains et pertes par catégorie');
    expect(within(section).getByText('Aucune donnée sur cette période')).toBeInTheDocument();
  });
});

describe('ships found and lost', () => {
  it('names each ship type with its counts', async () => {
    open((s) => {
      s.summary.ships = { found: { '202': 5 }, lost: { '204': 2 } };
    });
    const section = await card('Vaisseaux trouvés et perdus');
    const label = within(section).getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('Petit transporteur Trouvés 5, Perdus 0');
    expect(label).toContain('Chasseur léger Trouvés 0, Perdus 2');
  });

  it('says when no ship moved', async () => {
    open(() => {});
    const section = await card('Vaisseaux trouvés et perdus');
    expect(within(section).getByText('Aucune donnée sur cette période')).toBeInTheDocument();
  });
});
