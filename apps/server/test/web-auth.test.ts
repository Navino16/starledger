import { existsSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { Config } from '../src/config';
import { createDb } from '../src/db/db';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';

const PASSWORD = 'correct horse battery';

const config: Config = {
  databaseUrl: 'unused',
  sessionSecret: 'ab'.repeat(32),
  port: 3000,
  publicUrl: 'http://localhost:3000',
  trustProxy: ['loopback', 'linklocal', 'uniquelocal'],
  openSignup: false,
};

let t: TestDb;
let app: FastifyInstance;

beforeAll(async () => {
  t = await startTestDb();
  await createUser(t.db, { username: 'carol', password: PASSWORD, isAdmin: false, locale: 'fr' });
  await createUser(t.db, { username: 'dave', password: PASSWORD, isAdmin: false, locale: 'en' });
  app = buildApp(config, t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

const cookieOf = (res: { headers: Record<string, unknown> }) =>
  [res.headers['set-cookie'] ?? []]
    .flat()
    .map((c) => String(c).split(';')[0])
    .join('; ');

async function loginPage(headers: Record<string, string> = {}) {
  const res = await app.inject({ method: 'GET', url: '/login', headers });
  const token = /name="_csrf" value="([^"]+)"/.exec(res.body)?.[1] ?? '';
  return { res, token, cookie: cookieOf(res) };
}

async function postLogin(
  fields: Record<string, string>,
  opts: { cookie?: string; headers?: Record<string, string>; remoteAddress?: string } = {},
) {
  return app.inject({
    method: 'POST',
    url: '/login',
    remoteAddress: opts.remoteAddress,
    headers: { ...opts.headers, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    payload: new URLSearchParams(fields).toString(),
  });
}

const form = { 'content-type': 'application/x-www-form-urlencoded' };

describe('web auth', () => {
  it('serves /healthz', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('redirects /account to /login without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/account' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('redirects / to /login without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('rejects a POST without a CSRF token with 403', async () => {
    const { cookie } = await loginPage();
    const res = await postLogin(
      { username: 'carol', password: PASSWORD },
      { cookie, headers: form, remoteAddress: '10.0.0.1' },
    );
    expect(res.statusCode).toBe(403);
  });

  it('logs in, sets a hardened cookie and reaches /account, then logs out', async () => {
    const { token, cookie } = await loginPage();
    const res = await postLogin(
      { username: 'Carol', password: PASSWORD, _csrf: token },
      { cookie, headers: form, remoteAddress: '10.0.0.2' },
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/account');
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//i);
    expect(setCookie).not.toMatch(/Secure/i);

    const session = cookieOf(res);
    const account = await app.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie: session },
    });
    expect(account.statusCode).toBe(200);
    expect(account.body).toContain('carol');
    expect(account.body).toContain('Déconnexion');

    const root = await app.inject({ method: 'GET', url: '/', headers: { cookie: session } });
    expect(root.headers.location).toBe('/account');

    const logoutToken = /name="_csrf" value="([^"]+)"/.exec(account.body)?.[1] ?? '';
    const logout = await app.inject({
      method: 'POST',
      url: '/logout',
      headers: { ...form, cookie: cookieOf(account.headers['set-cookie'] ? account : res) },
      payload: new URLSearchParams({ _csrf: logoutToken }).toString(),
    });
    expect(logout.statusCode).toBe(302);
    expect(logout.headers.location).toBe('/login');
    const cleared = String(logout.headers['set-cookie']);
    expect(cleared).toMatch(/session=;/);
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    const after = await app.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie: cookieOf(logout) },
    });
    expect(after.statusCode).toBe(302);
    expect(after.headers.location).toBe('/login');
  });

  it('rejects POST /logout without a CSRF token with 403', async () => {
    const res = await app.inject({ method: 'POST', url: '/logout', headers: form, payload: '' });
    expect(res.statusCode).toBe(403);
  });

  it('renders a localized page on CSRF failure', async () => {
    const { cookie } = await loginPage({ 'accept-language': 'fr' });
    const res = await postLogin(
      { username: 'carol', password: PASSWORD },
      { cookie, headers: { ...form, 'accept-language': 'fr' }, remoteAddress: '10.0.0.4' },
    );
    expect(res.statusCode).toBe(403);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('Jeton de formulaire invalide');
  });

  it('returns 503 on /healthz when the database is unreachable', async () => {
    const dead = createDb('postgres://u:p@127.0.0.1:1/db');
    const deadApp = buildApp(config, dead);
    const res = await deadApp.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(503);
    await deadApp.close();
    await dead.destroy();
  });

  it('marks the cookie Secure behind an HTTPS proxy', async () => {
    const { res } = await loginPage({ 'x-forwarded-proto': 'https' });
    expect(String(res.headers['set-cookie'])).toMatch(/Secure/i);
  });

  it('shows a localized error and keeps the username on failed login', async () => {
    const { token, cookie } = await loginPage({ 'accept-language': 'fr-FR,fr;q=0.9' });
    const res = await postLogin(
      { username: '<b>nobody</b>', password: 'hunter2hunter2', _csrf: token },
      {
        cookie,
        headers: { ...form, 'accept-language': 'fr-FR,fr;q=0.9' },
        remoteAddress: '10.0.0.3',
      },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Identifiants invalides');
    expect(res.body).toContain('&lt;b&gt;nobody&lt;/b&gt;');
    expect(res.body).not.toContain('<b>nobody</b>');
    expect(res.body).not.toContain('hunter2hunter2');

    const wrongPass = await postLogin(
      { username: 'dave', password: 'wrong password!!', _csrf: token },
      { cookie, headers: form, remoteAddress: '10.0.0.3' },
    );
    expect(wrongPass.statusCode).toBe(200);
    expect(wrongPass.body).toContain('Invalid credentials');
    expect(wrongPass.body).toContain('value="dave"');
  });

  it('renders French for Accept-Language fr, English by default', async () => {
    const fr = await app.inject({
      method: 'GET',
      url: '/login',
      headers: { 'accept-language': 'fr-CH, fr;q=0.9, en;q=0.8' },
    });
    expect(fr.body).toContain('Connexion');
    const none = await app.inject({ method: 'GET', url: '/login' });
    expect(none.body).toContain('Sign in');
    const de = await app.inject({
      method: 'GET',
      url: '/login',
      headers: { 'accept-language': 'de' },
    });
    expect(de.body).toContain('Sign in');
  });

  it('rate-limits POST /login to 10 per minute per IP', async () => {
    const { token, cookie } = await loginPage();
    const attempt = () =>
      postLogin(
        { username: 'nobody', password: 'whatever12345', _csrf: token },
        { cookie, headers: form, remoteAddress: '10.9.9.9' },
      );
    for (let i = 0; i < 10; i++) expect((await attempt()).statusCode).toBe(200);
    const limited = await attempt();
    expect(limited.statusCode).toBe(429);
    expect(limited.body).toContain('Too many attempts');
    const other = await app.inject({ method: 'GET', url: '/login', remoteAddress: '10.9.9.9' });
    expect(other.statusCode).toBe(200);
  });
});

describe('build output', () => {
  it.skipIf(!existsSync(new URL('../dist/index.js', import.meta.url)))(
    'ships the views next to the bundle',
    () => {
      expect(existsSync(new URL('../dist/web/views/login.eta', import.meta.url))).toBe(true);
    },
  );
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
    const { token, cookie } = await loginPage();
    const attempt = (n: number) =>
      postLogin(
        { username: 'nobody', password: 'whatever12345', _csrf: token },
        {
          cookie,
          headers: { ...form, 'x-forwarded-for': `198.51.100.${n}` },
          remoteAddress: '203.0.113.5',
        },
      );
    for (let i = 0; i < 10; i++) expect((await attempt(i)).statusCode).toBe(200);
    expect((await attempt(99)).statusCode).toBe(429);
  });

  it('trusts X-Forwarded-For and -Proto from a private proxy address', async () => {
    const probe = await ipProbe();
    const res = await probe.inject({
      method: 'GET',
      url: '/_ip',
      remoteAddress: '172.18.0.2',
      headers: { 'x-forwarded-for': '198.51.100.7' },
    });
    expect(res.body).toBe('198.51.100.7');
    const login = await probe.inject({
      method: 'GET',
      url: '/login',
      remoteAddress: '172.18.0.2',
      headers: { 'x-forwarded-for': '198.51.100.7', 'x-forwarded-proto': 'https' },
    });
    expect(String(login.headers['set-cookie'])).toMatch(/Secure/i);
    await probe.close();
  });
});
