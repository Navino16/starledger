import { SHIP_TECH_NAMES, type ShipCounts } from '@app/shared';
import { el } from '../dom';
import { amountParts } from '../format';
import { shipIcon } from '../icons';

const short = (n: number) => {
  const { value, unit } = amountParts(n);
  return `${value}${unit}`;
};

const SHIPS = Object.entries(SHIP_TECH_NAMES)
  .map(([tech, id]) => ({ tech, id }))
  .sort((a, b) => Number(a.id) - Number(b.id));

// Not fleet ships (solar satellite, crawler): shown only once found or lost
const HIDDEN_WHEN_IDLE = new Set(['212', '217']);

export function renderShips(
  doc: Document,
  ships: { found: ShipCounts; lost: ShipCounts } | undefined,
): HTMLElement {
  const grid = el(doc, 'div', { className: 'starledger-shipgrid' });
  if (!ships) {
    grid.textContent = '?';
    return grid;
  }
  for (const { tech, id } of SHIPS) {
    const found = ships.found[id] ?? 0;
    const lost = ships.lost[id] ?? 0;
    const idle = found === 0 && lost === 0;
    if (idle && HIDDEN_WHEN_IDLE.has(id)) continue;
    const counts = el(
      doc,
      'span',
      { className: 'starledger-shipcounts' },
      el(doc, 'span', { className: 'starledger-found', textContent: short(found) }),
    );
    if (lost > 0) {
      counts.append(
        el(doc, 'span', {
          className: 'starledger-lost is-negative',
          textContent: short(-lost),
        }),
      );
    }
    const cell = el(
      doc,
      'div',
      { className: 'starledger-shiptile' },
      shipIcon(doc, id, tech),
      counts,
    );
    cell.dataset.ship = id;
    if (idle) cell.classList.add('is-idle');
    grid.append(cell);
  }
  return grid;
}
