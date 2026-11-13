import type { DetailRow, DetailRowKey, StatsResponse } from '@app/shared';
import type { MessageKey, T } from '../../i18n';
import { el } from '../dom';
import { amountParts, formatAmount, formatPartial } from '../format';
import { type IconKind, resourceIcon } from '../icons';

const ROWS: [DetailRowKey, MessageKey][] = [
  ['expeditions', 'catExpeditions'],
  ['combats', 'catCombats'],
  ['recycling', 'catRecycling'],
  ['wreckfields', 'catWreckfields'],
  ['anomalies', 'catAnomalies'],
  ['discoveries', 'catDiscoveries'],
  ['fuel', 'catFuel'],
  ['trades', 'catTrades'],
  ['total', 'catTotal'],
];

const SHIPS_INCLUDED = new Set<DetailRowKey>([
  'expeditions',
  'combats',
  'wreckfields',
  'anomalies',
]);

type Column = { id: string; label: MessageKey; icon?: IconKind; res?: string };

const COLUMNS: Column[] = [
  { id: 'count', label: 'colCount' },
  { id: 'metal', label: 'tileMetal', icon: 'metal', res: 'metal' },
  { id: 'crystal', label: 'tileCrystal', icon: 'crystal', res: 'crystal' },
  { id: 'deuterium', label: 'tileDeuterium', icon: 'deuterium', res: 'deuterium' },
  { id: 'msu', label: 'tileMsu', res: 'msu' },
  { id: 'darkMatter', label: 'tileDarkMatter', icon: 'darkMatter', res: 'darkMatter' },
  { id: 'artefacts', label: 'tileArtefacts', icon: 'artefacts', res: 'artefacts' },
  { id: 'lithium', label: 'tileLithium', icon: 'lithium', res: 'lithium' },
];

// undefined = field missing from an older server ("?"); null = not applicable ("-")
function cellValue(row: DetailRow | undefined, id: string): number | null | undefined {
  if (!row) return undefined;
  switch (id) {
    case 'count':
      return row.count;
    case 'msu':
      return row.msu;
    case 'darkMatter':
      return row.darkMatter;
    case 'artefacts':
      return row.artefacts;
    case 'lithium':
      return row.lithium;
    default:
      return row.resources ? row.resources[id as 'metal' | 'crystal' | 'deuterium'] : null;
  }
}

function unknownFor(
  key: DetailRowKey,
  col: string,
  rows: StatsResponse['summary']['rows'],
): number {
  if (!rows) return 0;
  const fuelCounted = rows.fuel.resources !== null;
  const fuelUnknown = fuelCounted ? rows.fuel.unknown : 0;
  if (key === 'fuel') return col === 'deuterium' || col === 'msu' ? fuelUnknown : 0;
  if (key === 'anomalies') return col === 'lithium' ? rows.anomalies.unknown : 0;
  if (key === 'total') {
    if (col === 'deuterium' || col === 'msu') return fuelUnknown;
    if (col === 'lithium') return rows.anomalies.unknown;
  }
  return 0;
}

function dataCell(
  doc: Document,
  key: DetailRowKey,
  rows: StatsResponse['summary']['rows'],
  col: Column,
): HTMLElement {
  const row = rows?.[key];
  const td = el(doc, 'td', {});
  td.dataset.col = col.id;
  const fuelIgnored = key === 'fuel' && row?.resources === null;
  const value =
    fuelIgnored && (col.id === 'deuterium' || col.id === 'msu') ? null : cellValue(row, col.id);
  if (value === null) {
    td.textContent = '-';
    td.className = 'is-empty';
    return td;
  }
  const unknown = unknownFor(key, col.id, rows);
  const { value: num, unit } = amountParts(value ?? null);
  const suffix = value !== undefined && unknown > 0 ? ` + ? (${unknown})` : '';
  if (num === '0' && !suffix) td.classList.add('is-zero');
  if (col.id === 'count') {
    td.textContent = `${num}${unit}${suffix}`;
    return td;
  }
  const span = el(doc, 'span', { className: 'starledger-amount', textContent: num });
  if (unit) span.append(el(doc, 'span', { className: 'starledger-unit', textContent: unit }));
  if (suffix) span.append(suffix);
  if (col.res) span.dataset.res = col.res;
  td.append(span);
  if (num.startsWith('-')) td.classList.add('is-negative');
  return td;
}

function anomalyCounts(t: T, stats: StatsResponse): string | null {
  const a = stats.summary.anomalies;
  if (!a) return null;
  const n = {
    scans: a.lithium?.scans ?? 0,
    collects: a.lithium?.collects ?? 0,
    rewards: a.rewards?.count ?? 0,
    combats: a.combats?.count ?? 0,
  };
  if (n.scans + n.collects + n.rewards + n.combats === 0) return null;
  return t('anomalyCounts', {
    scans: formatAmount(n.scans),
    collects: formatAmount(n.collects),
    rewards: formatAmount(n.rewards),
    combats: formatAmount(n.combats),
  });
}

export function renderTable(doc: Document, t: T, stats: StatsResponse): HTMLElement {
  const { rows } = stats.summary;
  const table = el(doc, 'table', { className: 'starledger-balance' });
  const head = el(doc, 'tr', {}, el(doc, 'th', { title: t('colCategory') }));
  for (const col of COLUMNS) {
    const th = el(doc, 'th', { title: t(col.label) });
    th.dataset.col = col.id;
    if (col.icon) th.append(resourceIcon(doc, col.icon, t(col.label)));
    else th.textContent = col.id === 'count' ? '➤' : t(col.label);
    head.append(th);
  }
  table.append(head);

  for (const [key, label] of ROWS) {
    const row = rows?.[key];
    if (key === 'trades' && (row?.count ?? null) === null) continue;
    const tr = el(doc, 'tr', {}, el(doc, 'td', { textContent: t(label) }));
    tr.dataset.category = key;
    const hints = rowHints(t, stats, key);
    if (hints.length > 0) tr.title = hints.join(' · ');
    for (const col of COLUMNS) tr.append(dataCell(doc, key, rows, col));
    table.append(tr);
  }
  return el(doc, 'div', { className: 'starledger-tablewrap' }, table);
}

// Details kept out of the window, shown on hover of their row
function rowHints(t: T, stats: StatsResponse, key: DetailRowKey): string[] {
  const { summary, settings, counts } = stats;
  const hints: string[] = [];
  if (SHIPS_INCLUDED.has(key)) hints.push(t('shipsValueIncluded'));
  if (key === 'anomalies') {
    const l = summary.anomalies?.lithium;
    if (l && (l.spent > 0 || l.refunded > 0 || l.spentUnknown > 0 || l.refundUnknown > 0)) {
      hints.push(
        t('lithiumSummary', {
          spent: formatPartial(l.spent, l.spentUnknown),
          refunded: formatPartial(l.refunded, l.refundUnknown),
          net: formatPartial(l.net, l.spentUnknown + l.refundUnknown),
        }),
      );
    }
    if (l && (l.darkMatterSpent > 0 || l.darkMatterUnknown > 0)) {
      hints.push(
        t('anomalyDarkMatter', { n: formatPartial(l.darkMatterSpent, l.darkMatterUnknown) }),
      );
    }
    const r = summary.anomalies?.rewards;
    const xp = Object.values(r?.xpByLifeform ?? {}).reduce((a, b) => a + b, 0);
    const xpUnknown = r?.xpUnknown ?? 0;
    if (xp > 0 || xpUnknown > 0) hints.push(t('anomalyXp', { n: formatPartial(xp, xpUnknown) }));
    const line = anomalyCounts(t, stats);
    if (line) hints.push(line);
  }
  if (key === 'combats') {
    const c = summary.combats;
    if (c && c.won + c.lost + c.draw > 0) {
      hints.push(
        t('combatOutcomes', {
          won: formatAmount(c.won),
          lost: formatAmount(c.lost),
          draw: formatAmount(c.draw),
        }),
      );
    }
  }
  if (key === 'discoveries') {
    const xp = Object.values(summary.discoveries?.xpByLifeform ?? {}).reduce((a, b) => a + b, 0);
    if (xp > 0) hints.push(t('discoveriesXp', { n: formatAmount(xp) }));
  }
  if (key === 'fuel') {
    const fuelUnknown = summary.fuel?.unknownCount ?? 0;
    if (fuelUnknown > 0) hints.push(t('fuelUnknownNote', { n: String(fuelUnknown) }));
    if (settings?.ignoreConsumption) hints.push(t('fuelIgnoredNote'));
  }
  if (key === 'total') {
    const unrecognized = counts?.unrecognized ?? 0;
    if (unrecognized > 0) {
      hints.push(
        t(unrecognized === 1 ? 'unrecognizedOne' : 'unrecognized', { n: String(unrecognized) }),
      );
    }
    const conflicts = summary.conflictCount ?? 0;
    if (conflicts > 0) {
      hints.push(t(conflicts === 1 ? 'conflictsOne' : 'conflicts', { n: String(conflicts) }));
    }
  }
  return hints;
}
