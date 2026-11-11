import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  SESSION_SECRET: 'a'.repeat(64),
  PUBLIC_URL: 'https://starledger.example.com',
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(base);
    expect(config.port).toBe(3000);
    expect(config.trustProxy).toBe(true);
    expect(config.openSignup).toBe(false);
    expect(config.publicUrl).toBe(base.PUBLIC_URL);
  });

  it('parses explicit values', () => {
    const config = loadConfig({ ...base, PORT: '8080', TRUST_PROXY: 'false', OPEN_SIGNUP: 'true' });
    expect(config.port).toBe(8080);
    expect(config.trustProxy).toBe(false);
    expect(config.openSignup).toBe(true);
  });

  it('rejects a SESSION_SECRET that is too short', () => {
    expect(() => loadConfig({ ...base, SESSION_SECRET: 'abcd' })).toThrow();
  });

  it('rejects a non-hexadecimal SESSION_SECRET', () => {
    expect(() => loadConfig({ ...base, SESSION_SECRET: 'z'.repeat(64) })).toThrow();
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = base;
    expect(() => loadConfig(rest)).toThrow();
  });
});
