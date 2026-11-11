import { Writable } from 'node:stream';
import {
  API_RATE_LIMIT_PER_MINUTE,
  API_VERSION,
  isVersionBelow,
  MIN_CLIENT_VERSION,
  parseSemver,
} from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { generateApiKey, revokeApiKey } from '../src/auth/api-keys';
import type { Config } from '../src/config';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';

const config: Config = {
  databaseUrl: 'unused',
  sessionSecret: 'ab'.repeat(32),
  port: 3000,
  publicUrl: 'http://localhost:3000',
  trustProxy: false,
  openSignup: false,
};

let t: TestDb;
let app: FastifyInstance;
let aliceKey: string;

const ping = (headers: Record<string, string>, remoteAddress?: string) =>
  app.inject({ method: 'GET', url: '/api/v1/ping', headers, remoteAddress });
const authed = (key = aliceKey, version = '0.1.0') => ({
  authorization: `Bearer ${key}`,
  'x-client-version': version,
});

beforeAll(async () => {
  t = await startTestDb();
  const alice = await createUser(t.db, {
    username: 'alice',
    password: 'correct horse battery',
    isAdmin: false,
    locale: 'en',
  });
  aliceKey = await generateApiKey(t.db, alice.id);
  app = buildApp(config, t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

describe('shared version helpers', () => {
  it('exposes the API constants', () => {
    expect(API_VERSION).toBe(1);
    expect(MIN_CLIENT_VERSION).toBe('0.1.0');
    expect(API_RATE_LIMIT_PER_MINUTE).toBe(120);
  });

  it('parses strict semver only', () => {
    expect(parseSemver('1.22.3')).toEqual([1, 22, 3]);
    for (const bad of [
      '1.2',
      '1.2.3.4',
      'v1.2.3',
      '01.2.3',
      '1.2.3-beta',
      '',
      '99999999999999999999.0.0',
    ]) {
      expect(parseSemver(bad)).toBeNull();
    }
  });

  it('compares numerically', () => {
    expect(isVersionBelow('0.0.1', '0.1.0')).toBe(true);
    expect(isVersionBelow('0.1.0', '0.1.0')).toBe(false);
    expect(isVersionBelow('0.10.0', '0.9.0')).toBe(false);
    expect(isVersionBelow('1.0.0', '0.9.9')).toBe(false);
    expect(isVersionBelow('0.1.9', '0.2.0')).toBe(true);
    expect(() => isVersionBelow('x', '0.1.0')).toThrow();
  });
});

describe('GET /api/v1/ping', () => {
  it('returns the username for a valid key', async () => {
    const res = await ping(authed());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, username: 'alice', apiVersion: 1 });
  });

  it('accepts a newer client version and a lowercase scheme', async () => {
    const res = await ping({ authorization: `bearer ${aliceKey}`, 'x-client-version': '2.0.0' });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a missing or malformed Authorization header with 401', async () => {
    const headers: Record<string, string>[] = [
      {},
      { authorization: aliceKey },
      { authorization: `Basic ${aliceKey}` },
      { authorization: 'Bearer' },
      { authorization: 'Bearer ' },
      { authorization: `Bearer ${aliceKey} extra` },
      { authorization: `Bearer ${aliceKey}, Bearer ${aliceKey}` },
      { authorization: 'Bearer slk_nope' },
      { authorization: `Bearer slk_${'A'.repeat(43)}` },
    ];
    for (const h of headers) {
      const res = await ping({ ...h, 'x-client-version': '0.1.0' });
      expect(res.statusCode, JSON.stringify(h)).toBe(401);
      expect(res.json().error).toBe('invalid_key');
      expect(typeof res.json().message).toBe('string');
    }
  });

  it('rejects a revoked key with 401', async () => {
    const bob = await createUser(t.db, {
      username: 'bob',
      password: 'correct horse battery',
      isAdmin: false,
      locale: 'en',
    });
    const key = await generateApiKey(t.db, bob.id);
    expect((await ping(authed(key))).statusCode).toBe(200);
    await revokeApiKey(t.db, bob.id);
    const res = await ping(authed(key));
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('invalid_key');
  });

  it('rejects a client below the minimum with 426', async () => {
    const res = await ping(authed(aliceKey, '0.0.1'));
    expect(res.statusCode).toBe(426);
    expect(res.json().error).toBe('client_outdated');
  });

  it('rejects a missing or malformed version with 400', async () => {
    const missing = await ping({ authorization: `Bearer ${aliceKey}` });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error).toBe('invalid_payload');
    for (const v of ['1.2', 'abc', 'v1.0.0', '1.0.0-beta']) {
      const res = await ping(authed(aliceKey, v));
      expect(res.statusCode, v).toBe(400);
      expect(res.json().error).toBe('invalid_payload');
    }
  });

  it('checks auth before the version', async () => {
    const res = await ping({ authorization: 'Bearer slk_bad', 'x-client-version': '0.0.1' });
    expect(res.statusCode).toBe(401);
    const noVersion = await ping({ authorization: 'Bearer slk_bad' });
    expect(noVersion.statusCode).toBe(401);
  });

  it('does not authenticate from a session cookie', async () => {
    const loginPage = await app.inject({ method: 'GET', url: '/login' });
    const token = /name="_csrf" value="([^"]+)"/.exec(loginPage.body)?.[1] ?? '';
    const pageCookies = [loginPage.headers['set-cookie'] ?? []]
      .flat()
      .map((c) => String(c).split(';')[0])
      .join('; ');
    const login = await app.inject({
      method: 'POST',
      url: '/login',
      headers: { cookie: pageCookies, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        username: 'alice',
        password: 'correct horse battery',
        _csrf: token,
      }).toString(),
    });
    expect(login.statusCode).toBe(302);
    const cookie = [login.headers['set-cookie'] ?? []]
      .flat()
      .map((c) => String(c).split(';')[0])
      .join('; ');
    const web = await app.inject({ method: 'GET', url: '/account', headers: { cookie } });
    expect(web.statusCode).toBe(200);
    const res = await ping({ cookie, 'x-client-version': '0.1.0' });
    expect(res.statusCode).toBe(401);
  });

  it('returns JSON 404 for unknown API routes, not the web error page', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope', headers: authed() });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.json().error).toBe('not_found');
    const web = await app.inject({ method: 'GET', url: '/nope' });
    expect(web.headers['content-type']).toMatch(/text\/html/);
  });

  it('answers 401 on an unknown API path without a key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('invalid_key');
  });

  it('does not log the API key', async () => {
    let logs = '';
    const logStream = new Writable({
      write(chunk, _enc, cb) {
        logs += chunk.toString();
        cb();
      },
    });
    const logged = buildApp(config, t.db, { logStream });
    const res = await logged.inject({ method: 'GET', url: '/api/v1/ping', headers: authed() });
    expect(res.statusCode).toBe(200);
    await logged.inject({ method: 'GET', url: '/api/v1/nope', headers: authed() });
    await logged.close();
    expect(logs).toContain('/api/v1/ping');
    expect(logs).not.toContain(aliceKey);
  });
});

describe('rate limiting', () => {
  it('limits a key to 120 requests per minute and replies rate_limited', async () => {
    const carol = await createUser(t.db, {
      username: 'carol',
      password: 'correct horse battery',
      isAdmin: false,
      locale: 'en',
    });
    const key = await generateApiKey(t.db, carol.id);
    for (let i = 0; i < API_RATE_LIMIT_PER_MINUTE; i++) {
      expect((await ping(authed(key))).statusCode).toBe(200);
    }
    const res = await ping(authed(key));
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
    expect((await ping(authed(aliceKey))).statusCode).toBe(200);
  }, 60_000);

  it('limits failed authentication by IP', async () => {
    const ip = '203.0.113.9';
    for (let i = 0; i < API_RATE_LIMIT_PER_MINUTE; i++) {
      expect((await ping({}, ip)).statusCode).toBe(401);
    }
    const res = await ping({}, ip);
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
    expect((await ping({}, '203.0.113.10')).statusCode).toBe(401);
  }, 60_000);
});
