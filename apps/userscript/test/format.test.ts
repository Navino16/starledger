import { describe, expect, it } from 'vitest';
import { amountParts } from '../src/ui/format';

describe('amountParts', () => {
  it.each([
    [0, '0', ''],
    [999, '999', ''],
    [-777, '-777', ''],
    [1000, '1.0', 'k'],
    [-79_500, '-79.5', 'k'],
    [999_960, '1.00', 'M'],
    [424_600_000, '424.60', 'M'],
    [2_500_000_000, '2.50', 'G'],
    [null, '?', ''],
    [Number.NaN, '?', ''],
  ])('splits %s into %s and %s', (n, value, unit) => {
    expect(amountParts(n)).toEqual({ value, unit });
  });
});
