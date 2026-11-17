import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { isInvitationUsable } from '../src/users/invitations';
import { getPasswordReset } from '../src/users/passwords';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';
import { siteClient, testConfig } from './helpers/site';

const PASSWORD = 'correct horse battery';

let t: TestDb;
let app: FastifyInstance;

beforeAll(async () => {
  t = await startTestDb();
  await createUser(t.db, { username: 'root', password: PASSWORD, isAdmin: true, locale: 'en' });
  await createUser(t.db, { username: 'vega', password: PASSWORD, isAdmin: false, locale: 'en' });
  app = buildApp(testConfig(), t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

describe('admin routes', () => {
  it('answer 401 to visitors and 403 to non-admins', async () => {
    const anonymous = siteClient(app);
    await anonymous.session();
    expect((await anonymous.call('POST', '/admin/invitations')).statusCode).toBe(401);
    const player = siteClient(app);
    await player.login('vega', PASSWORD);
    for (const res of [
      await player.call('POST', '/admin/invitations'),
      await player.call('POST', '/admin/password-resets', { username: 'vega' }),
    ]) {
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'forbidden' });
    }
  });

  it('creates an invitation link', async () => {
    const admin = siteClient(app);
    await admin.login('root', PASSWORD);
    const res = await admin.call('POST', '/admin/invitations');
    expect(res.statusCode).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const { url } = res.json();
    expect(url).toMatch(/^http:\/\/localhost:3000\/invite\//);
    expect(await isInvitationUsable(t.db, url.split('/invite/')[1])).toBe(true);
  });

  it('creates a password reset link, or 404 for an unknown user', async () => {
    const admin = siteClient(app);
    await admin.login('root', PASSWORD);
    const res = await admin.call('POST', '/admin/password-resets', { username: ' VEGA ' });
    expect(res.statusCode).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const { url, username } = res.json();
    expect(username).toBe('vega');
    expect(await getPasswordReset(t.db, url.split('/reset/')[1])).toEqual({ username: 'vega' });

    const unknown = await admin.call('POST', '/admin/password-resets', { username: 'nobody' });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual({ error: 'unknown_user' });
  });
});
