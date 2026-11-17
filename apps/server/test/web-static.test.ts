import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import type { Config } from '../src/config';
import { createDb } from '../src/db/db';

const config: Config = {
  databaseUrl: 'unused',
  sessionSecret: 'ab'.repeat(32),
  port: 3000,
  publicUrl: 'http://localhost:3000',
  trustProxy: ['loopback'],
  openSignup: false,
};

const INDEX = '<!doctype html><div id="root"></div>';

// No route below reaches the database: an unreachable one keeps the test container-free.
const db = createDb('postgres://u:p@127.0.0.1:1/db');
let webRoot: string;
let app: FastifyInstance;

beforeAll(async () => {
  webRoot = mkdtempSync(join(tmpdir(), 'starledger-web-'));
  mkdirSync(join(webRoot, 'assets'));
  writeFileSync(join(webRoot, 'index.html'), INDEX);
  writeFileSync(join(webRoot, 'assets', 'a.js'), 'console.log(1);');
  app = buildApp(config, db, { webRoot });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  rmSync(webRoot, { recursive: true, force: true });
});

const get = (url: string) => app.inject({ method: 'GET', url });

describe('web app hosting', () => {
  it.each(['/', '/account', '/settings?x=1', '/invite/abc', '/reset/xyz'])(
    'answers %s with index.html, revalidated on each visit',
    async (url) => {
      const res = await get(url);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.body).toBe(INDEX);
    },
  );

  it('serves hashed assets with an immutable cache', async () => {
    const res = await get('/assets/a.js');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('console.log(1);');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('keeps API and missing asset 404s in JSON', async () => {
    for (const url of ['/api/v1/nope', '/api/site/nope', '/api/nope', '/assets/old.js']) {
      const res = await get(url);
      expect(res.statusCode, url).toBe(404);
      expect(res.headers['content-type'], url).toMatch(/application\/json/);
    }
  });

  it('keeps /healthz in JSON', async () => {
    const res = await get('/healthz');
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.json()).toEqual({ ok: false });
  });

  it('redirects the old invitations page to /admin', async () => {
    const res = await get('/admin/invitations');
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/admin');
  });

  it('no longer accepts the old HTML form posts', async () => {
    for (const url of ['/login', '/logout', '/account/api-keys']) {
      const res = await app.inject({ method: 'POST', url, payload: {} });
      expect(res.statusCode, url).toBe(404);
      expect(res.json()).toEqual({ error: 'not_found' });
    }
  });

  it('serves only the APIs without a web build', async () => {
    const bare = buildApp(config, db, { webRoot: join(webRoot, 'missing') });
    const res = await bare.inject({ method: 'GET', url: '/account' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found' });
    await bare.close();
  });
});
