import { existsSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { Config } from '../src/config';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';

const PASSWORD = 'correct horse battery';

const config: Config = {
  databaseUrl: 'unused',
  sessionSecret: 'ab'.repeat(32),
  port: 3000,
  publicUrl: 'http://localhost:3000',
  trustProxy: true,
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
    expect((await attempt()).statusCode).toBe(429);
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
