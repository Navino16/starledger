import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { rawInt, rawJson } from '../../src/parsers/raw';

describe('rawInt', () => {
  it.each([
    ['absent', {}, null],
    ['empty', { n: '' }, null],
    ['integer', { n: '-42' }, -42],
    ['non-integer', { n: '1.5' }, 'invalid'],
    ['garbage', { n: 'abc' }, 'invalid'],
    ['beyond MAX_SAFE_INTEGER', { n: '99999999999999999999' }, 'invalid'],
  ])('%s', (_n, raw, expected) => {
    expect(rawInt(raw, 'n')).toBe(expected);
  });
});

describe('rawJson', () => {
  const schema = z.object({ a: z.number() });

  it.each([
    ['absent', {}, null],
    ['empty', { j: '' }, null],
    ['malformed JSON', { j: '{' }, 'invalid'],
    ['wrong shape', { j: '{"a":"x"}' }, 'invalid'],
  ])('%s', (_n, raw, expected) => {
    expect(rawJson(raw, 'j', schema)).toBe(expected);
  });

  it('returns the parsed value', () => {
    expect(rawJson({ j: '{"a":1}' }, 'j', schema)).toEqual({ a: 1 });
  });
});
