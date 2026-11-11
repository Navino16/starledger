import { expect, it } from 'vitest';
import { VERSION } from '../src/index';

it('exposes a semver VERSION', () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
