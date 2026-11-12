import { SHIP_TECH_NAMES, type ShipCounts } from '@app/shared';
import { el } from '../dom';
import { formatAmount } from '../format';
import { type IconPage, shipIcon } from '../icons';

const SHIPS = Object.entries(SHIP_TECH_NAMES)
  .map(([tech, id]) => ({ tech, id }))
  .sort((a, b) => Number(a.id) - Number(b.id));

export function renderShips(
  doc: Document,
  ships: { found: ShipCounts; lost: ShipCounts } | undefined,
  page?: IconPage,
): HTMLElement {
  const grid = el(doc, 'div', { className: 'starledger-shipgrid' });
  if (!ships) {
    grid.textContent = '?';
    return grid;
  }
  for (const { tech, id } of SHIPS) {
    const found = ships.found[id] ?? 0;
    const lost = ships.lost[id] ?? 0;
    const cell = el(
      doc,
      'div',
      { className: 'starledger-shiptile' },
      shipIcon(doc, id, tech, page),
      el(doc, 'span', { className: 'starledger-found', textContent: formatAmount(found) }),
    );
    cell.dataset.ship = id;
    if (lost > 0) {
      cell.append(
        el(doc, 'span', {
          className: 'starledger-lost is-negative',
          textContent: formatAmount(-lost),
        }),
      );
    }
    grid.append(cell);
  }
  return grid;
}
