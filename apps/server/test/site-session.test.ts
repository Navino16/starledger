import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';
import { siteClient, testConfig } from './helpers/site';

const PASSWORD = 'correct horse battery';

let t: TestDb;
let app: FastifyInstance;

beforeAll(async () => {
  t = await startTestDb();
  await createUser(t.db, { username: 'alice', password: PASSWORD, isAdmin: false, locale: 'fr' });
  app = buildApp(testConfig(), t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

describe('GET /api/site/session', () => {
  it('describes an anonymous visitor in the negotiated language', async () => {
    const client = siteClient(app);
    const res = await client.call('GET', '/session', undefined, {
      headers: { 'accept-language': 'fr-FR,fr;q=0.9' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      user: null,
      locale: 'fr',
      csrfToken: expect.any(String),
      openSignup: false,
    });
    expect(body.csrfToken.length).toBeGreaterThan(10);
  });
});

describe('POST /api/site/login', () => {
  it('opens a session with the right credentials', async () => {
    const client = siteClient(app);
    await client.session();
    const res = await client.call('POST', '/login', { username: 'Alice', password: PASSWORD });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ user: { username: 'alice', isAdmin: false, locale: 'fr' } });
    expect((await client.session()).user).toEqual({
      username: 'alice',
      isAdmin: false,
      locale: 'fr',
    });
  });

  it('answers 401 invalid_credentials on a wrong password', async () => {
    const client = siteClient(app);
    await client.session();
    const res = await client.call('POST', '/login', { username: 'alice', password: 'nope' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_credentials' });
    expect((await client.session()).user).toBeNull();
  });

  it('answers 403 csrf_invalid as JSON without the token header', async () => {
    const client = siteClient(app);
    await client.session();
    const res = await client.call(
      'POST',
      '/login',
      { username: 'alice', password: PASSWORD },
      { csrf: false },
    );
    expect(res.statusCode).toBe(403);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.json()).toEqual({ error: 'csrf_invalid' });
  });

  it('answers 400 invalid_payload on a malformed body', async () => {
    const client = siteClient(app);
    await client.session();
    const res = await client.call('POST', '/login', { username: 42 });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_payload' });
  });

  it('rate limits the 11th attempt in a minute', async () => {
    const client = siteClient(app);
    await client.session();
    for (let i = 0; i < 10; i++) {
      const res = await client.call('POST', '/login', { username: 'alice', password: 'nope' });
      expect(res.statusCode).toBe(401);
    }
    const res = await client.call('POST', '/login', { username: 'alice', password: PASSWORD });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: 'rate_limited' });
  });
});

describe('POST /api/site/logout', () => {
  it('closes the session', async () => {
    const client = siteClient(app);
    await client.login('alice', PASSWORD);
    const res = await client.call('POST', '/logout');
    expect(res.statusCode).toBe(204);
    expect((await client.session()).user).toBeNull();
  });
});

describe('unknown site routes', () => {
  it('answer a JSON 404', async () => {
    const res = await siteClient(app).call('GET', '/nope');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
  });
});
