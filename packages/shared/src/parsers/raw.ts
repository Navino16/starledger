import type { z } from 'zod';
import { parseCoords } from '../coords';
import type { Coords } from '../domain';
import type { ParsedEvent, ParseResult } from '../events';
import type { MessageObservation } from '../observation';

export type Raw = MessageObservation['raw'];

export function rawJson<T>(raw: Raw, key: string, schema: z.ZodType<T>): T | null | 'invalid' {
  const value = raw[key];
  if (value === undefined || value === '') return null;
  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    return 'invalid';
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : 'invalid';
}

export function rawInt(raw: Raw, key: string): number | null | 'invalid' {
  const value = raw[key];
  if (value === undefined || value === '') return null;
  return /^-?\d+$/.test(value) ? Number(value) : 'invalid';
}

export function externalKey(obs: MessageObservation): string {
  return `msg:${obs.msgId}`;
}

export function unrecognized(
  obs: MessageObservation,
  reason: string,
  occurredAt: number | null,
): ParseResult {
  return { status: 'unrecognized', externalKey: externalKey(obs), occurredAt, reason };
}

// docs/ogame-data-formats.md §2: timestamp is Unix seconds
export function occurredAtOf(raw: Raw): number | null {
  const ts = rawInt(raw, 'timestamp');
  return typeof ts === 'number' ? ts * 1000 : null;
}

export function coordsOf(raw: Raw): Coords | null {
  const value = raw.coords;
  return value === undefined ? null : parseCoords(value);
}

export class Invalid extends Error {}

export function need<T>(value: T | null | 'invalid', attr: string): T | null {
  if (value === 'invalid') throw new Invalid(`invalid ${attr}`);
  return value;
}

export function tryBuild(
  obs: MessageObservation,
  build: (obs: MessageObservation) => ParsedEvent,
): ParseResult {
  const occurredAt = occurredAtOf(obs.raw);
  if (occurredAt === null) return unrecognized(obs, 'missing or invalid timestamp', null);
  try {
    return { status: 'ok', externalKey: externalKey(obs), occurredAt, event: build(obs) };
  } catch (e) {
    if (e instanceof Invalid) return unrecognized(obs, e.message, occurredAt);
    throw e;
  }
}
