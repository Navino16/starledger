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

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
