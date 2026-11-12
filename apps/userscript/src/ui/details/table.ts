import type { DetailRow, DetailRowKey, StatsResponse } from '@app/shared';
import type { MessageKey, T } from '../../i18n';
import { el } from '../dom';
import { formatAmount, formatPartial } from '../format';
import { type IconKind, type IconPage, resourceIcon } from '../icons';

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
    return td;
  }
  const unknown = unknownFor(key, col.id, rows);
  const text = value === undefined ? '?' : formatPartial(value, unknown);
  if (col.id === 'count') {
    td.textContent = text;
    return td;
  }
  const span = el(doc, 'span', { className: 'starledger-amount', textContent: text });
  if (col.res) span.dataset.res = col.res;
  td.append(span);
  if (text.startsWith('-')) td.classList.add('is-negative');
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

export function renderTable(
  doc: Document,
  t: T,
  stats: StatsResponse,
  win?: IconPage,
): HTMLElement {
  const { rows, anomalies } = stats.summary;
  const table = el(doc, 'table', { className: 'starledger-balance' });
  const head = el(doc, 'tr', {}, el(doc, 'th', { textContent: t('colCategory') }));
  for (const col of COLUMNS) {
    const th = el(doc, 'th', { title: t(col.label) });
    th.dataset.col = col.id;
    if (col.icon) th.append(resourceIcon(doc, col.icon, t(col.label), win));
    else th.textContent = col.id === 'count' ? '#' : t(col.label);
    head.append(th);
  }
  table.append(head);

  for (const [key, label] of ROWS) {
    const row = rows?.[key];
    if (key === 'trades' && (row?.count ?? null) === null) continue;
    const tr = el(doc, 'tr', {}, el(doc, 'td', { textContent: t(label) }));
    tr.dataset.category = key;
    const hints: string[] = [];
    if (SHIPS_INCLUDED.has(key)) hints.push(t('shipsValueIncluded'));
    const paid = anomalies?.lithium;
    if (key === 'anomalies' && paid && (paid.darkMatterSpent > 0 || paid.darkMatterUnknown > 0)) {
      hints.push(
        t('anomalyDarkMatter', { n: formatPartial(paid.darkMatterSpent, paid.darkMatterUnknown) }),
      );
    }
    const counts = key === 'anomalies' ? anomalyCounts(t, stats) : null;
    if (counts) hints.push(counts);
    if (hints.length > 0) tr.title = hints.join(' · ');
    for (const col of COLUMNS) tr.append(dataCell(doc, key, rows, col));
    table.append(tr);
  }
  return el(doc, 'div', { className: 'starledger-tablewrap' }, table);
}

const note = (doc: Document, text: string, className = 'starledger-note'): HTMLElement =>
  el(doc, 'p', { className, textContent: text });

export function renderNotes(doc: Document, t: T, stats: StatsResponse): HTMLElement {
  const { summary, settings, counts } = stats;
  const box = el(doc, 'div', { className: 'starledger-notes' });
  const lines: HTMLElement[] = [];
  const add = (text: string, className?: string) => lines.push(note(doc, text, className));

  const fuelUnknown = summary.fuel?.unknownCount ?? 0;
  if (fuelUnknown > 0) add(t('fuelUnknownNote', { n: String(fuelUnknown) }));
  if (settings?.ignoreConsumption) add(t('fuelIgnoredNote'));

  const l = summary.anomalies?.lithium;
  if (l) {
    const parts: string[] = [];
    if (l.spent > 0 || l.refunded > 0 || l.spentUnknown > 0 || l.refundUnknown > 0) {
      parts.push(
        t('lithiumSummary', {
          spent: formatPartial(l.spent, l.spentUnknown),
          refunded: formatPartial(l.refunded, l.refundUnknown),
          net: formatPartial(l.net, l.spentUnknown + l.refundUnknown),
        }),
      );
    }
    const counts = anomalyCounts(t, stats);
    if (counts) parts.push(counts);
    if (parts.length > 0) add(parts.join(' · '));
    if (l.darkMatterSpent > 0 || l.darkMatterUnknown > 0) {
      add(t('anomalyDarkMatter', { n: formatPartial(l.darkMatterSpent, l.darkMatterUnknown) }));
    }
  }

  const c = summary.combats;
  if (c && c.won + c.lost + c.draw > 0) {
    add(
      t('combatOutcomes', {
        won: formatAmount(c.won),
        lost: formatAmount(c.lost),
        draw: formatAmount(c.draw),
      }),
    );
  }

  const xp = Object.values(summary.discoveries?.xpByLifeform ?? {}).reduce((a, b) => a + b, 0);
  if (xp > 0) add(t('discoveriesXp', { n: formatAmount(xp) }));

  const trades = summary.trades;
  if (
    trades &&
    !settings?.includeTradesInBalance &&
    trades.receivedCount + trades.deliveredCount > 0
  ) {
    const triple = (r: { metal: number; crystal: number; deuterium: number }) =>
      `${t('resMetal')} ${formatAmount(r.metal)} · ${t('resCrystal')} ${formatAmount(r.crystal)} · ${t('resDeuterium')} ${formatAmount(r.deuterium)}`;
    const { received: r, delivered: d } = trades;
    add(
      t('tradesNotIncluded', {
        received: triple(r),
        sent: triple(d),
        net: triple({
          metal: r.metal - d.metal,
          crystal: r.crystal - d.crystal,
          deuterium: r.deuterium - d.deuterium,
        }),
        receivedCount: formatAmount(trades.receivedCount),
        deliveredCount: formatAmount(trades.deliveredCount),
      }),
    );
  }

  const unrecognized = counts?.unrecognized ?? 0;
  if (unrecognized > 0) {
    add(
      t(unrecognized === 1 ? 'unrecognizedOne' : 'unrecognized', { n: String(unrecognized) }),
      'starledger-unrecognized',
    );
  }
  const conflicts = summary.conflictCount ?? 0;
  if (conflicts > 0) {
    add(
      t(conflicts === 1 ? 'conflictsOne' : 'conflicts', { n: String(conflicts) }),
      'starledger-conflicts',
    );
  }
  box.append(...lines);
  return box;
}
