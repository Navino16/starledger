import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { createDb } from '../src/db/db';
import { redactUrl } from '../src/redact';
import { negotiateLocale } from '../src/site/session';
import { setPassword } from '../src/users/passwords';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';
import { siteClient, testConfig } from './helpers/site';

const PASSWORD = 'correct horse battery';
const config = testConfig();

let t: TestDb;
let app: FastifyInstance;

beforeAll(async () => {
  t = await startTestDb();
  await createUser(t.db, { username: 'carol', password: PASSWORD, isAdmin: false, locale: 'fr' });
  app = buildApp(config, t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

const setCookie = (res: LightMyRequestResponse) => String(res.headers['set-cookie'] ?? '');
const cookieOf = (res: LightMyRequestResponse) =>
  [res.headers['set-cookie'] ?? []]
    .flat()
    .map((c) => String(c).split(';')[0])
    .join('; ');

const deadDbApp = () => {
  const dead = createDb('postgres://u:p@127.0.0.1:1/db');
  return { dead, deadApp: buildApp(config, dead) };
};

describe('/healthz', () => {
  it('answers ok while the database is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('answers 503 when the database is unreachable', async () => {
    const { dead, deadApp } = deadDbApp();
    const res = await deadApp.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(503);
    await deadApp.close();
    await dead.destroy();
  });

  it('stays at 503 with a session cookie whose user cannot load', async () => {
    const client = siteClient(app);
    await client.login('carol', PASSWORD);
    const { dead, deadApp } = deadDbApp();
    for (const url of ['/healthz', '/healthz?probe=1']) {
      const res = await deadApp.inject({
        method: 'GET',
        url,
        headers: { cookie: client.cookie() },
      });
      expect(res.statusCode).toBe(503);
    }
    await deadApp.close();
    await dead.destroy();
  });
});

describe('session cookie', () => {
  it('is hardened on login and cleared on logout', async () => {
    const client = siteClient(app);
    const login = await client.login('carol', PASSWORD);
    const cookie = setCookie(login);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).not.toMatch(/Secure/i);

    const logout = await client.call('POST', '/logout');
    const cleared = setCookie(logout);
    expect(cleared).toMatch(/session=;/);
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect((await client.session()).user).toBeNull();
  });

  it('is marked Secure behind an HTTPS proxy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/site/session',
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(setCookie(res)).toMatch(/Secure/i);
  });

  it('is required, with its CSRF token, on every write route', async () => {
    const open = buildApp(testConfig({ openSignup: true }), t.db);
    const client = siteClient(open);
    await client.login('carol', PASSWORD);
    const writes: [Parameters<typeof client.call>[0], string, unknown?][] = [
      ['POST', '/logout'],
      ['POST', '/api-keys', { name: 'PC' }],
      ['DELETE', '/api-keys/00000000-0000-0000-0000-000000000000'],
      ['POST', '/password', { current: PASSWORD, next: 'another long password' }],
      ['PUT', '/settings/1/en', {}],
      ['POST', '/invitations/token', { username: 'nocsrf', password: PASSWORD }],
      ['POST', '/password-resets/token', { password: PASSWORD }],
      ['POST', '/signup', { username: 'nocsrf', password: PASSWORD }],
      ['POST', '/admin/invitations'],
      ['POST', '/admin/password-resets', { username: 'carol' }],
    ];
    for (const [method, path, body] of writes) {
      const res = await client.call(method, path, body, { csrf: false });
      expect(res.statusCode, `${method} ${path}`).toBe(403);
      expect(res.json()).toEqual({ error: 'csrf_invalid' });
    }
    expect((await client.session()).user?.username).toBe('carol');
    await open.close();
  });
});

describe('session user', () => {
  it('is dropped once the user is deleted', async () => {
    await createUser(t.db, { username: 'ghost', password: PASSWORD, isAdmin: false, locale: 'en' });
    const client = siteClient(app);
    await client.login('ghost', PASSWORD);
    expect((await client.call('GET', '/api-keys')).statusCode).toBe(200);
    await t.db.deleteFrom('users').where('username', '=', 'ghost').execute();
    const res = await client.call('GET', '/api-keys');
    expect(res.statusCode).toBe(401);
    expect(setCookie(res)).toMatch(/session=;/);
    expect((await client.session()).user).toBeNull();
  });

  it('follows the locale and admin flag stored in the database', async () => {
    await createUser(t.db, {
      username: 'shifty',
      password: PASSWORD,
      isAdmin: false,
      locale: 'en',
    });
    const client = siteClient(app);
    await client.login('shifty', PASSWORD);
    expect((await client.call('POST', '/admin/invitations')).statusCode).toBe(403);
    await t.db
      .updateTable('users')
      .set({ locale: 'fr', is_admin: true })
      .where('username', '=', 'shifty')
      .execute();
    const session = await client.call('GET', '/session', undefined, {
      headers: { 'accept-language': 'en' },
    });
    expect(session.json()).toMatchObject({
      user: { username: 'shifty', isAdmin: true, locale: 'fr' },
      locale: 'fr',
    });
    expect((await client.call('POST', '/admin/invitations')).statusCode).toBe(201);
  });

  it('is signed out when the session version moves on', async () => {
    const user = await createUser(t.db, {
      username: 'erin',
      password: PASSWORD,
      isAdmin: false,
      locale: 'en',
    });
    const client = siteClient(app);
    await client.login('erin', PASSWORD);
    await setPassword(t.db, user.id, PASSWORD);
    expect((await client.call('GET', '/api-keys')).statusCode).toBe(401);
    expect((await client.session()).user).toBeNull();
  });

  it('accepts a cookie issued before session versions existed', async () => {
    const user = await createUser(t.db, {
      username: 'frank',
      password: PASSWORD,
      isAdmin: false,
      locale: 'en',
    });
    const legacy = app.encodeSecureSession(app.createSecureSession({ userId: user.id }));
    const res = await app.inject({
      method: 'GET',
      url: '/api/site/session',
      headers: { cookie: `session=${encodeURIComponent(legacy)}` },
    });
    expect(res.json().user?.username).toBe('frank');
  });
});

describe('negotiateLocale', () => {
  it.each([
    ['fr-CH, fr;q=0.9, en;q=0.8', 'fr'],
    ['de, fr;q=0.5, en;q=0.4', 'fr'],
    ['en-GB, fr;q=0.9', 'en'],
    ['fr;q=0, en', 'en'],
    ['de', 'en'],
    [undefined, 'en'],
  ])('maps %s to %s', (header, locale) => {
    expect(negotiateLocale(header)).toBe(locale);
  });
});

describe('proxy trust', () => {
  async function ipProbe() {
    const probe = buildApp(config, t.db);
    probe.get('/_ip', async (request) => request.ip);
    await probe.ready();
    return probe;
  }

  it('ignores X-Forwarded-For from a public remote address', async () => {
    const probe = await ipProbe();
    const res = await probe.inject({
      method: 'GET',
      url: '/_ip',
      remoteAddress: '203.0.113.5',
      headers: { 'x-forwarded-for': '198.51.100.7' },
    });
    expect(res.body).toBe('203.0.113.5');
    await probe.close();
  });

  it('still rate-limits a public client forging X-Forwarded-For', async () => {
    const remoteAddress = '203.0.113.5';
    const session = await app.inject({ method: 'GET', url: '/api/site/session', remoteAddress });
    const headers = {
      cookie: cookieOf(session),
      'x-csrf-token': session.json().csrfToken,
      'content-type': 'application/json',
    };
    const attempt = (n: number) =>
      app.inject({
        method: 'POST',
        url: '/api/site/login',
        remoteAddress,
        headers: { ...headers, 'x-forwarded-for': `198.51.100.${n}` },
        payload: JSON.stringify({ username: 'nobody', password: 'whatever12345' }),
      });
    for (let i = 0; i < 10; i++) expect((await attempt(i)).statusCode).toBe(401);
    expect((await attempt(99)).statusCode).toBe(429);
  });

  it('trusts X-Forwarded-For and -Proto from a private proxy address', async () => {
    const probe = await ipProbe();
    const headers = { 'x-forwarded-for': '198.51.100.7', 'x-forwarded-proto': 'https' };
    const res = await probe.inject({
      method: 'GET',
      url: '/_ip',
      remoteAddress: '172.18.0.2',
      headers,
    });
    expect(res.body).toBe('198.51.100.7');
    const session = await probe.inject({
      method: 'GET',
      url: '/api/site/session',
      remoteAddress: '172.18.0.2',
      headers,
    });
    expect(setCookie(session)).toMatch(/Secure/i);
    await probe.close();
  });
});

describe('redactUrl', () => {
  it('hides invitation and reset tokens, keeping the query string', () => {
    expect(redactUrl('/invite/abc_DEF-1?x=1')).toBe('/invite/[redacted]?x=1');
    expect(redactUrl('/reset/abc_DEF-1')).toBe('/reset/[redacted]');
    expect(redactUrl('/api/site/invitations/abc')).toBe('/api/site/invitations/[redacted]');
    expect(redactUrl('/api/site/password-resets/abc?y=2')).toBe(
      '/api/site/password-resets/[redacted]?y=2',
    );
    expect(redactUrl('/account')).toBe('/account');
  });
});
