const UNITS: [string, number][] = [
  ['k', 1e3],
  ['M', 1e6],
  ['G', 1e9],
];

// One decimal, trailing ".0" dropped; losses keep their sign; unknown is '?', never 0.
export function formatAmount(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '?';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (Math.round(abs) < 1000) return Math.round(abs) === 0 ? '0' : `${sign}${Math.round(abs)}`;
  for (const [i, [unit, divisor]] of UNITS.entries()) {
    const rounded = Math.round((abs / divisor) * 10) / 10;
    // 999.96k must read 1M, not 1000k
    if (rounded < 1000 || i === UNITS.length - 1) return `${sign}${rounded}${unit}`;
  }
  return '?';
}

const FIXED_DECIMALS: Record<string, number> = { k: 1, M: 2, G: 2 };

// Detail window format (mockup v3): fixed decimals per unit, unit returned apart for a smaller font.
export function amountParts(n: number | null): { value: string; unit: string } {
  if (n === null || !Number.isFinite(n)) return { value: '?', unit: '' };
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (Math.round(abs) < 1000) {
    return { value: Math.round(abs) === 0 ? '0' : `${sign}${Math.round(abs)}`, unit: '' };
  }
  for (const [i, [unit, divisor]] of UNITS.entries()) {
    const digits = FIXED_DECIMALS[unit] ?? 1;
    const rounded = (abs / divisor).toFixed(digits);
    if (Number(rounded) < 1000 || i === UNITS.length - 1)
      return { value: `${sign}${rounded}`, unit };
  }
  return { value: '?', unit: '' };
}

// Unknown is not 0: entries without a known amount are counted apart, never added as 0.
export function formatPartial(n: number | null, unknownCount: number | undefined): string {
  return unknownCount && unknownCount > 0
    ? `${formatAmount(n)} + ? (${unknownCount})`
    : formatAmount(n);
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
