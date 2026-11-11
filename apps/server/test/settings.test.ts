import { DEFAULT_VALUATION } from '@app/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { Config } from '../src/config';
import { getValuationSettings, saveValuationSettings } from '../src/settings/settings';
import { createUser } from '../src/users/users';
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
let aliceId: string;
let bobId: string;
let ip = 0;

beforeAll(async () => {
  t = await startTestDb();
  aliceId = (
    await createUser(t.db, { username: 'alice', password: PASSWORD, isAdmin: false, locale: 'en' })
  ).id;
  bobId = (
    await createUser(t.db, { username: 'bob', password: PASSWORD, isAdmin: false, locale: 'fr' })
  ).id;
  app = buildApp(config, t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

beforeEach(async () => {
  await t.db.deleteFrom('universe_settings').execute();
  await t.db.deleteFrom('accounts').execute();
});

const cookieOf = (res: { headers: Record<string, unknown> }) =>
  [res.headers['set-cookie'] ?? []]
    .flat()
    .map((c) => String(c).split(';')[0])
    .join('; ');
const csrfOf = (body: string) => /name="_csrf" value="([^"]+)"/.exec(body)?.[1] ?? '';

async function post(url: string, fields: Record<string, string>, cookie: string) {
  return app.inject({
    method: 'POST',
    url,
    remoteAddress: `10.3.0.${++ip}`,
    headers: { ...form, cookie },
    payload: new URLSearchParams(fields).toString(),
  });
}

async function login(username: string) {
  const page = await app.inject({ method: 'GET', url: '/login' });
  const res = await post(
    '/login',
    { username, password: PASSWORD, _csrf: csrfOf(page.body) },
    cookieOf(page),
  );
  return cookieOf(res);
}

async function accountPage(cookie: string) {
  const res = await app.inject({ method: 'GET', url: '/account', headers: { cookie } });
  return { res, token: csrfOf(res.body), cookie: cookieOf(res) || cookie };
}

const addAccount = (userId: string, serverId = 808, lang = 'en') =>
  t.db
    .insertInto('accounts')
    .values({ user_id: userId, server_id: serverId, lang, player_id: 1, player_name: 'p' })
    .execute();

const valid = {
  msuMetal: '2.5',
  msuCrystal: '1.5',
  msuDeuterium: '1',
  expeditionShipRatio: '50',
  ignoreExpeShipsLoss: 'on',
};

describe('valuation settings store', () => {
  it('returns a copy of the defaults when no row exists', async () => {
    const s = await getValuationSettings(t.db, aliceId, 808, 'en');
    expect(s).toEqual(DEFAULT_VALUATION);
    expect(s).not.toBe(DEFAULT_VALUATION);
    expect(s.msuRatio).not.toBe(DEFAULT_VALUATION.msuRatio);
  });

  it('round-trips decimal ratios exactly and upserts', async () => {
    const s = {
      msuRatio: [2.5, 1.5, 1] as [number, number, number],
      expeditionShipRatio: 40,
      ignoreExpeShipsLoss: true,
      ignoreConsumption: false,
      includeTradesInBalance: true,
    };
    await saveValuationSettings(t.db, aliceId, 808, 'en', s);
    expect(await getValuationSettings(t.db, aliceId, 808, 'en')).toEqual(s);
    await saveValuationSettings(t.db, aliceId, 808, 'en', { ...s, msuRatio: [3.1, 2.2, 1.3] });
    expect((await getValuationSettings(t.db, aliceId, 808, 'en')).msuRatio).toEqual([
      3.1, 2.2, 1.3,
    ]);
    expect(await getValuationSettings(t.db, aliceId, 808, 'fr')).toEqual(DEFAULT_VALUATION);
  });
});

describe('POST /account/settings/:serverId/:lang', () => {
  it('renders one prefilled form per known universe', async () => {
    await addAccount(aliceId, 808, 'en');
    await addAccount(aliceId, 12, 'fr');
    await addAccount(bobId, 77, 'en');
    await saveValuationSettings(t.db, aliceId, 808, 'en', {
      ...DEFAULT_VALUATION,
      msuRatio: [2.5, 1.5, 1],
    });
    const { res } = await accountPage(await login('alice'));
    expect(res.body.match(/action="\/account\/settings\//g)).toHaveLength(2);
    expect(res.body).not.toContain('/account/settings/77');
    expect(res.body).toContain('action="/account/settings/808/en"');
    expect(res.body).toContain('action="/account/settings/12/fr"');
    expect(res.body).toContain('value="2.5"');
    expect(res.body).toContain('value="1.5"');
  });

  it('shows a note when the user has no accounts', async () => {
    const { res } = await accountPage(await login('alice'));
    expect(res.body).not.toContain('/account/settings/');
    expect(res.body).toContain('userscript');
  });

  it('saves for the session user and redirects to /account', async () => {
    await addAccount(aliceId);
    const { token, cookie } = await accountPage(await login('alice'));
    const res = await post('/account/settings/808/en', { ...valid, _csrf: token }, cookie);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/account');
    expect(await getValuationSettings(t.db, aliceId, 808, 'en')).toEqual({
      msuRatio: [2.5, 1.5, 1],
      expeditionShipRatio: 50,
      ignoreExpeShipsLoss: true,
      ignoreConsumption: false,
      includeTradesInBalance: false,
    });
  });

  it.each([
    ['zero ratio', { msuMetal: '0' }],
    ['denormal ratio', { msuMetal: '5e-324' }],
    ['negative ratio', { msuCrystal: '-1' }],
    ['huge ratio', { msuDeuterium: '101' }],
    ['non numeric ratio', { msuMetal: 'abc' }],
    ['empty ratio', { msuMetal: '' }],
    ['ship ratio above 100', { expeditionShipRatio: '101' }],
    ['negative ship ratio', { expeditionShipRatio: '-1' }],
    ['fractional ship ratio', { expeditionShipRatio: '50.5' }],
  ])('rejects %s with 400 and saves nothing', async (_name, override) => {
    await addAccount(aliceId);
    const { token, cookie } = await accountPage(await login('alice'));
    const res = await post(
      '/account/settings/808/en',
      { ...valid, ...override, _csrf: token },
      cookie,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('role="alert"');
    expect(await getValuationSettings(t.db, aliceId, 808, 'en')).toEqual(DEFAULT_VALUATION);
  });

  it('re-renders the submitted values and the error on the failing universe form', async () => {
    await addAccount(aliceId);
    await addAccount(aliceId, 900, 'fr');
    const { token, cookie } = await accountPage(await login('alice'));
    const res = await post(
      '/account/settings/808/en',
      { ...valid, msuMetal: 'abc', msuCrystal: '7.5', _csrf: token },
      cookie,
    );
    expect(res.statusCode).toBe(400);
    const [other, failing] = res.body.split('action="/account/settings/808/en"') as [
      string,
      string,
    ];
    expect(other).not.toContain('role="alert"');
    expect(failing.split('action="/account/settings/900/fr"')[0]).toContain('role="alert"');
    expect(failing).toContain('value="abc"');
    expect(failing).toContain('value="7.5"');
    expect(res.body.split('action="/account/settings/900/fr"')[1]).not.toContain('role="alert"');
  });

  it('accepts the ship ratio bounds 0 and 100', async () => {
    await addAccount(aliceId);
    const { token, cookie } = await accountPage(await login('alice'));
    for (const v of ['0', '100']) {
      const res = await post(
        '/account/settings/808/en',
        { ...valid, expeditionShipRatio: v, _csrf: token },
        cookie,
      );
      expect(res.statusCode).toBe(302);
    }
  });

  it('returns 404 for a universe the user has no account on', async () => {
    await addAccount(aliceId);
    const { token, cookie } = await accountPage(await login('alice'));
    for (const url of [
      '/account/settings/999/en',
      '/account/settings/808/xx',
      '/account/settings/abc/en',
      '/account/settings/2147483648/en',
      '/account/settings/808/%00',
      '/account/settings/808/EN',
      '/account/settings/0x328/en',
      '/account/settings/808.0/en',
    ]) {
      const res = await post(url, { ...valid, _csrf: token }, cookie);
      expect(res.statusCode).toBe(404);
    }
  });

  it("does not let another user modify a universe's settings", async () => {
    await addAccount(aliceId);
    const alice = { ...DEFAULT_VALUATION, expeditionShipRatio: 70 };
    await saveValuationSettings(t.db, aliceId, 808, 'en', alice);
    const { token, cookie } = await accountPage(await login('bob'));
    const res = await post('/account/settings/808/en', { ...valid, _csrf: token }, cookie);
    expect(res.statusCode).toBe(404);
    expect(await getValuationSettings(t.db, aliceId, 808, 'en')).toEqual(alice);
    expect(await getValuationSettings(t.db, bobId, 808, 'en')).toEqual(DEFAULT_VALUATION);
  });

  it('rejects a missing CSRF token with 403', async () => {
    await addAccount(aliceId);
    const { cookie } = await accountPage(await login('alice'));
    const res = await post('/account/settings/808/en', valid, cookie);
    expect(res.statusCode).toBe(403);
    expect(await getValuationSettings(t.db, aliceId, 808, 'en')).toEqual(DEFAULT_VALUATION);
  });

  it('redirects anonymous users to /login', async () => {
    const res = await post('/account/settings/808/en', valid, '');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
