import type { StatsSummary, ValuationSettings } from './stats';
import type { Period } from './time';

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

export function isVersionBelow(version: string, minimum: string): boolean {
  const a = parseSemver(version);
  const b = parseSemver(minimum);
  if (!a || !b) throw new Error('invalid semver');
  for (let i = 0; i < 3; i++) {
    if ((a[i] as number) !== (b[i] as number)) return (a[i] as number) < (b[i] as number);
  }
  return false;
}

export type StatsPeriod = Period;

export type StatsResponse = {
  period: StatsPeriod;
  range: { from: string; to: string } | null;
  generatedAt: number;
  summary: StatsSummary;
  counts: { unrecognized: number };
  settings: ValuationSettings;
};

export type ApiError =
  | 'invalid_key'
  | 'invalid_payload'
  | 'client_outdated'
  | 'rate_limited'
  | 'payload_too_large'
  | 'not_found'
  | 'server_error'
  | 'not_configured'
  | 'unreachable';
