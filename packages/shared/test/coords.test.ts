import { describe, expect, it } from 'vitest';
import { isExpeditionPosition, parseCoords } from '../src/coords';

describe('parseCoords', () => {
  it('parses plain and bracketed coordinates', () => {
    const expected = { galaxy: 4, system: 120, position: 8 };
    expect(parseCoords('4:120:8')).toEqual(expected);
    expect(parseCoords('[4:120:8]')).toEqual(expected);
  });

  it('returns null for malformed input', () => {
    expect(parseCoords('x')).toBeNull();
    expect(parseCoords('1:2')).toBeNull();
    expect(parseCoords('1:2:3:4')).toBeNull();
    expect(parseCoords('')).toBeNull();
  });
});

describe('isExpeditionPosition', () => {
  it('is true only for position 16', () => {
    expect(isExpeditionPosition({ galaxy: 1, system: 1, position: 16 })).toBe(true);
    expect(isExpeditionPosition({ galaxy: 1, system: 1, position: 15 })).toBe(false);
  });
});
