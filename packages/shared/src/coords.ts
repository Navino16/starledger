import type { Coords } from './domain';

const COORDS_RE = /^\[?(\d+):(\d+):(\d+)\]?$/;

export function parseCoords(s: string): Coords | null {
  const m = COORDS_RE.exec(s.trim());
  if (!m) return null;
  return { galaxy: Number(m[1]), system: Number(m[2]), position: Number(m[3]) };
}

export function isExpeditionPosition(c: Coords): boolean {
  return c.position === 16;
}
