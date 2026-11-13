import { SHIP_TECH_NAMES } from '@app/shared';
import { describe, expect, it } from 'vitest';
import { renderShips } from '../src/ui/details/ships';

const tile = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-ship="${id}"]`);

describe('renderShips', () => {
  const ids = (g: HTMLElement) =>
    [...g.querySelectorAll<HTMLElement>('[data-ship]')].map((e) => e.dataset.ship);

  it('renders the 15 fleet ships sorted by id when nothing moved', () => {
    expect(ids(renderShips(document, { found: {}, lost: {} }))).toEqual(
      Object.values(SHIP_TECH_NAMES)
        .filter((id) => id !== '212' && id !== '217')
        .sort((a, b) => Number(a) - Number(b)),
    );
  });

  it('adds the solar satellite or crawler once found or lost, and dims idle ships', () => {
    const g = renderShips(document, { found: { '202': 3 }, lost: { '212': 2 } });
    expect(ids(g)).toContain('212');
    expect(ids(g)).not.toContain('217');
    expect(tile(g, '202')?.classList.contains('is-idle')).toBe(false);
    expect(tile(g, '203')?.classList.contains('is-idle')).toBe(true);
  });

  it('keeps one decimal on thousands', () => {
    const g = renderShips(document, { found: { '204': 1000 }, lost: {} });
    expect(tile(g, '204')?.querySelector('.starledger-found')?.textContent).toBe('1.0k');
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
