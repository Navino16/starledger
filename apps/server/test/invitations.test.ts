import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { Config } from '../src/config';
import { consumeInvitation, createInvitation, InvitationError } from '../src/users/invitations';
import { createUser, verifyCredentials } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';

const PASSWORD = 'correct horse battery';
const form = { 'content-type': 'application/x-www-form-urlencoded' };

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
let openApp: FastifyInstance;
let adminId: string;
let ip = 0;

beforeAll(async () => {
  t = await startTestDb();
  const admin = await createUser(t.db, {
    username: 'admin',
    password: PASSWORD,
    isAdmin: true,
    locale: 'en',
  });
  adminId = admin.id;
  await createUser(t.db, { username: 'plain', password: PASSWORD, isAdmin: false, locale: 'en' });
  app = buildApp(config, t.db);
  openApp = buildApp({ ...config, openSignup: true }, t.db);
  await app.ready();
  await openApp.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await openApp.close();
  await t.teardown();
});

const cookieOf = (res: { headers: Record<string, unknown> }) =>
  [res.headers['set-cookie'] ?? []]
    .flat()
    .map((c) => String(c).split(';')[0])
    .join('; ');
const csrfOf = (body: string) => /name="_csrf" value="([^"]+)"/.exec(body)?.[1] ?? '';
const nextIp = () => `10.1.${Math.floor(++ip / 250)}.${ip % 250}`;

async function post(
  target: FastifyInstance,
  url: string,
  fields: Record<string, string>,
  cookie: string,
  extra: Record<string, string> = {},
) {
  return target.inject({
    method: 'POST',
    url,
    remoteAddress: nextIp(),
    headers: { ...form, cookie, ...extra },
    payload: new URLSearchParams(fields).toString(),
  });
}

async function login(username: string, password = PASSWORD) {
  const page = await app.inject({ method: 'GET', url: '/login' });
  const res = await post(
    app,
    '/login',
    { username, password, _csrf: csrfOf(page.body) },
    cookieOf(page),
  );
  expect(res.statusCode).toBe(302);
  return cookieOf(res);
}

async function createViaWeb(cookie: string): Promise<string> {
  const page = await app.inject({
    method: 'GET',
    url: '/admin/invitations',
    headers: { cookie },
  });
  expect(page.statusCode).toBe(200);
  const res = await post(
    app,
    '/admin/invitations',
    { _csrf: csrfOf(page.body) },
    cookieOf(page) || cookie,
  );
  expect(res.statusCode).toBe(200);
  expect(res.headers['cache-control']).toBe('no-store');
  const url = /http:\/\/localhost:3000\/invite\/[\w-]+/.exec(res.body)?.[0];
  expect(url).toBeDefined();
  return (url as string).replace('http://localhost:3000', '');
}

describe('createInvitation / consumeInvitation', () => {
  it('stores only the sha256 of a 32-byte base64url token', async () => {
    const { url } = await createInvitation(t.db, adminId, 'http://localhost:3000/');
    const token = url.replace('http://localhost:3000/invite/', '');
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    const row = await t.db
      .selectFrom('invitations')
      .selectAll()
      .where('token_hash', '=', createHash('sha256').update(token).digest('hex'))
      .executeTakeFirstOrThrow();
    expect(row.created_by).toBe(adminId);
    expect(row.used_at).toBeNull();
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('lets exactly one of two concurrent uses succeed', async () => {
    const { url } = await createInvitation(t.db, adminId, config.publicUrl);
    const token = url.split('/invite/')[1] as string;
    const results = await Promise.allSettled([
      consumeInvitation(t.db, token, { username: 'race-a', password: PASSWORD }),
      consumeInvitation(t.db, token, { username: 'race-b', password: PASSWORD }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected');
    expect((failed as PromiseRejectedResult).reason).toBeInstanceOf(InvitationError);
    const users = await t.db
      .selectFrom('users')
      .select('username')
      .where('username', 'in', ['race-a', 'race-b'])
      .execute();
    expect(users).toHaveLength(1);
  });

  it('does not consume the invitation when the new user is invalid', async () => {
    const { url } = await createInvitation(t.db, adminId, config.publicUrl);
    const token = url.split('/invite/')[1] as string;
    await expect(
      consumeInvitation(t.db, token, { username: 'x', password: PASSWORD }),
    ).rejects.toThrow();
    const user = await consumeInvitation(t.db, token, { username: 'retry', password: PASSWORD });
    expect(user.isAdmin).toBe(false);
    const row = await t.db
      .selectFrom('invitations')
      .select(['used_by', 'used_at'])
      .where('used_by', '=', user.id)
      .executeTakeFirstOrThrow();
    expect(row.used_at).not.toBeNull();
  });
});

describe('invitation web flow', () => {
  it('lets an admin invite a user who then signs up, is logged in, and can log in again', async () => {
    const adminCookie = await login('admin');
    const path = await createViaWeb(adminCookie);

    const page = await app.inject({ method: 'GET', url: path });
    expect(page.statusCode).toBe(200);
    const res = await post(
      app,
      path,
      { username: 'Newbie', password: PASSWORD, _csrf: csrfOf(page.body) },
      cookieOf(page),
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/account');
    const account = await app.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie: cookieOf(res) },
    });
    expect(account.statusCode).toBe(200);
    expect(account.body).toContain('newbie');
    expect((await verifyCredentials(t.db, 'newbie', PASSWORD))?.isAdmin).toBe(false);
    await login('newbie');

    const reused = await app.inject({ method: 'GET', url: path });
    expect(reused.statusCode).toBe(410);
    expect(reused.body).toContain('no longer valid');
    const reusedPost = await post(
      app,
      path,
      { username: 'other', password: PASSWORD, _csrf: csrfOf(page.body) },
      cookieOf(page),
    );
    expect(reusedPost.statusCode).toBe(410);
  });

  it('returns 410 for unknown and expired tokens, localized', async () => {
    const unknown = await app.inject({
      method: 'GET',
      url: '/invite/nope',
      headers: { 'accept-language': 'fr' },
    });
    expect(unknown.statusCode).toBe(410);
    expect(unknown.body).toContain('plus valide');

    const { url } = await createInvitation(t.db, adminId, config.publicUrl, -1);
    const expired = await app.inject({ method: 'GET', url: url.replace(config.publicUrl, '') });
    expect(expired.statusCode).toBe(410);
  });

  it('returns 410 when posting to an expired token', async () => {
    const { url } = await createInvitation(t.db, adminId, config.publicUrl, -1);
    const path = url.replace(config.publicUrl, '');
    const login = await app.inject({ method: 'GET', url: '/login' });
    const res = await post(
      app,
      path,
      { username: 'toolate', password: PASSWORD, _csrf: csrfOf(login.body) },
      cookieOf(login),
    );
    expect(res.statusCode).toBe(410);
  });

  it('shows validation errors without consuming the invitation', async () => {
    const { url } = await createInvitation(t.db, adminId, config.publicUrl);
    const path = url.replace(config.publicUrl, '');
    const page = await app.inject({ method: 'GET', url: path });
    const fields = (username: string, password: string) => ({
      username,
      password,
      _csrf: csrfOf(page.body),
    });
    const badName = await post(app, path, fields('Bad Name!', PASSWORD), cookieOf(page));
    expect(badName.statusCode).toBe(400);
    expect(badName.body).toContain('3 to 32');
    const short = await post(app, path, fields('okname', 'short'), cookieOf(page));
    expect(short.statusCode).toBe(400);
    expect(short.body).toContain('at least 12');
    const taken = await post(app, path, fields('plain', PASSWORD), cookieOf(page));
    expect(taken.statusCode).toBe(400);
    expect(taken.body).toContain('already taken');
    const ok = await post(app, path, fields('okname', PASSWORD), cookieOf(page));
    expect(ok.statusCode).toBe(302);
  });

  it('rejects a POST without a CSRF token', async () => {
    const { url } = await createInvitation(t.db, adminId, config.publicUrl);
    const res = await post(app, url.replace(config.publicUrl, ''), {}, '');
    expect(res.statusCode).toBe(403);
  });
});

describe('admin access', () => {
  it('returns 403 to non-admins on GET and POST', async () => {
    const cookie = await login('plain');
    const get = await app.inject({
      method: 'GET',
      url: '/admin/invitations',
      headers: { cookie },
    });
    expect(get.statusCode).toBe(403);
    const account = await app.inject({ method: 'GET', url: '/account', headers: { cookie } });
    const res = await post(
      app,
      '/admin/invitations',
      { _csrf: csrfOf(account.body) },
      cookieOf(account) || cookie,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toContain('You do not have access');
    expect(get.body).toContain('You do not have access');
  });

  it('redirects anonymous POSTs to /login before checking CSRF', async () => {
    const res = await post(app, '/admin/invitations', {}, '');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('redirects anonymous visitors to /login', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/invitations' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});

describe('requireUser', () => {
  it('drops the session of a deleted user', async () => {
    await createUser(t.db, { username: 'ghost', password: PASSWORD, isAdmin: false, locale: 'en' });
    const cookie = await login('ghost');
    expect(
      (await app.inject({ method: 'GET', url: '/account', headers: { cookie } })).statusCode,
    ).toBe(200);
    await t.db.deleteFrom('users').where('username', '=', 'ghost').execute();
    const res = await app.inject({ method: 'GET', url: '/account', headers: { cookie } });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
    const after = await app.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie: cookieOf(res) },
    });
    expect(after.headers.location).toBe('/login');
  });

  it('uses the locale and admin flag stored in the database', async () => {
    await createUser(t.db, {
      username: 'shifty',
      password: PASSWORD,
      isAdmin: false,
      locale: 'en',
    });
    const cookie = await login('shifty');
    const en = await app.inject({ method: 'GET', url: '/account', headers: { cookie } });
    expect(en.body).toContain('Sign out');
    await t.db
      .updateTable('users')
      .set({ locale: 'fr', is_admin: true })
      .where('username', '=', 'shifty')
      .execute();
    const fr = await app.inject({ method: 'GET', url: '/account', headers: { cookie } });
    expect(fr.body).toContain('Déconnexion');
    const admin = await app.inject({
      method: 'GET',
      url: '/admin/invitations',
      headers: { cookie },
    });
    expect(admin.statusCode).toBe(200);
  });
});

describe('locale and logging', () => {
  it('uses the logged-in user locale on pages outside requireUser', async () => {
    await createUser(t.db, {
      username: 'frenchy',
      password: PASSWORD,
      isAdmin: false,
      locale: 'fr',
    });
    const cookie = await login('frenchy');
    const loginPage = await app.inject({ method: 'GET', url: '/invite/nope', headers: { cookie } });
    expect(loginPage.statusCode).toBe(410);
    expect(loginPage.body).toContain('plus valide');
    const csrf = await post(app, '/logout', {}, cookie);
    expect(csrf.body).toContain('Jeton de formulaire invalide');
  });

  it('does not log invitation tokens', async () => {
    let logs = '';
    const logStream = new Writable({
      write(chunk, _enc, cb) {
        logs += chunk.toString();
        cb();
      },
    });
    const logged = buildApp(config, t.db, { logStream });
    const { url } = await createInvitation(t.db, adminId, config.publicUrl);
    const token = url.split('/invite/')[1] as string;
    const res = await logged.inject({ method: 'GET', url: `/invite/${token}?x=1` });
    expect(res.statusCode).toBe(200);
    await logged.close();
    expect(logs).toContain('/invite/[redacted]');
    expect(logs).not.toContain(token);
  });

  it('does not log invitation tokens on unmatched routes', async () => {
    let logs = '';
    const logStream = new Writable({
      write(chunk, _enc, cb) {
        logs += chunk.toString();
        cb();
      },
    });
    const logged = buildApp(config, t.db, { logStream });
    const { url } = await createInvitation(t.db, adminId, config.publicUrl);
    const token = url.split('/invite/')[1] as string;
    const res = await logged.inject({ method: 'GET', url: `/invite/${token}/` });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    await logged.close();
    expect(logs).toContain('not found');
    expect(logs).not.toContain(token);
  });

  it('rejects POST /admin/invitations without a CSRF token', async () => {
    const cookie = await login('admin');
    const res = await post(app, '/admin/invitations', {}, cookie);
    expect(res.statusCode).toBe(403);
  });
});

describe('open signup', () => {
  it('returns 404 on /signup when OPEN_SIGNUP is false', async () => {
    expect((await app.inject({ method: 'GET', url: '/signup' })).statusCode).toBe(404);
    const res = await post(app, '/signup', { username: 'abc', password: PASSWORD }, '');
    expect(res.statusCode).toBe(404);
  });

  it('rejects POST /signup without a CSRF token', async () => {
    const page = await openApp.inject({ method: 'GET', url: '/signup' });
    const res = await post(
      openApp,
      '/signup',
      { username: 'nocsrf', password: PASSWORD },
      cookieOf(page),
    );
    expect(res.statusCode).toBe(403);
  });

  it('creates a non-admin user and logs them in when OPEN_SIGNUP is true', async () => {
    const page = await openApp.inject({ method: 'GET', url: '/signup' });
    expect(page.statusCode).toBe(200);
    const res = await post(
      openApp,
      '/signup',
      { username: 'walkin', password: PASSWORD, _csrf: csrfOf(page.body) },
      cookieOf(page),
    );
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/account');
    expect((await verifyCredentials(t.db, 'walkin', PASSWORD))?.isAdmin).toBe(false);

    const bad = await post(
      openApp,
      '/signup',
      { username: 'a', password: PASSWORD, _csrf: csrfOf(page.body) },
      cookieOf(page),
    );
    expect(bad.statusCode).toBe(400);
  });
});
