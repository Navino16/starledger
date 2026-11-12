import { SHIP_TECH_NAMES } from '@app/shared';
import { describe, expect, it } from 'vitest';
import { renderShips } from '../src/ui/details/ships';

const tile = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-ship="${id}"]`);

describe('renderShips', () => {
  it('renders one tile per known ship, sorted by id', () => {
    const g = renderShips(document, { found: {}, lost: {} });
    const ids = [...g.querySelectorAll<HTMLElement>('[data-ship]')].map((e) => e.dataset.ship);
    expect(ids).toEqual(Object.values(SHIP_TECH_NAMES).sort((a, b) => Number(a) - Number(b)));
  });

  it('shows found and lost counts, the loss in the loss class', () => {
    const g = renderShips(document, { found: { '202': 400 }, lost: { '202': 20 } });
    expect(tile(g, '202')?.querySelector('.starledger-found')?.textContent).toBe('400');
    const lost = tile(g, '202')?.querySelector('.starledger-lost');
    expect(lost?.textContent).toBe('-20');
    expect(lost?.classList.contains('is-negative')).toBe(true);
  });

  it('shows no loss line when nothing was lost', () => {
    const g = renderShips(document, { found: { '202': 5 }, lost: { '202': 0 } });
    expect(tile(g, '202')?.querySelector('.starledger-lost')).toBeNull();
    expect(tile(g, '203')?.querySelector('.starledger-found')?.textContent).toBe('0');
  });

  it('shows ? when the server sent no ships', () => {
    const g = renderShips(document, undefined);
    expect(g.textContent).toBe('?');
    expect(g.querySelector('[data-ship]')).toBeNull();
  });
});
