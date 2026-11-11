export const API_VERSION = 1;
export const MIN_CLIENT_VERSION = '0.1.0';
export const API_RATE_LIMIT_PER_MINUTE = 120;

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseSemver(value: string): [number, number, number] | null {
  const m = SEMVER.exec(value);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3])] as const;
  return parts.every(Number.isSafeInteger) ? [parts[0], parts[1], parts[2]] : null;
}

// True when `version` is strictly lower than `minimum`; both must be valid MAJOR.MINOR.PATCH.
export function isVersionBelow(version: string, minimum: string): boolean {
  const a = parseSemver(version);
  const b = parseSemver(minimum);
  if (!a || !b) throw new Error('invalid semver');
  for (let i = 0; i < 3; i++) {
    if ((a[i] as number) !== (b[i] as number)) return (a[i] as number) < (b[i] as number);
  }
  return false;
}
