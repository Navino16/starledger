import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { createInvitation } from '../src/users/invitations';
import { createPasswordReset } from '../src/users/passwords';
import { createUser, verifyCredentials } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';
import { siteClient, testConfig } from './helpers/site';

const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'another long password';
const config = testConfig();

let t: TestDb;
let app: FastifyInstance;
let adminId: string;

beforeAll(async () => {
  t = await startTestDb();
  adminId = (
    await createUser(t.db, { username: 'admin', password: PASSWORD, isAdmin: true, locale: 'en' })
  ).id;
  app = buildApp(config, t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

const inviteToken = async () =>
  (await createInvitation(t.db, adminId, config.publicUrl)).url.split('/invite/')[1] as string;

const resetToken = async (username: string) =>
  (await createPasswordReset(t.db, adminId, username, config.publicUrl)).url.split(
    '/reset/',
  )[1] as string;

describe('invitations', () => {
  it('creates an account and opens a session from a valid invitation', async () => {
    const token = await inviteToken();
    const client = siteClient(app);
    await client.session();
    expect((await client.call('GET', `/invitations/${token}`)).statusCode).toBe(204);
    const res = await client.call(
      'POST',
      `/invitations/${token}`,
      { username: 'Invited', password: PASSWORD },
      { headers: { 'accept-language': 'fr' } },
    );
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ user: { username: 'invited', isAdmin: false, locale: 'fr' } });
    expect((await client.session()).user?.username).toBe('invited');

    const again = siteClient(app);
    await again.session();
    expect((await again.call('GET', `/invitations/${token}`)).statusCode).toBe(410);
    const reuse = await again.call('POST', `/invitations/${token}`, {
      username: 'other',
      password: PASSWORD,
    });
    expect(reuse.statusCode).toBe(410);
    expect(reuse.json()).toEqual({ error: 'invitation_invalid' });
  });

  it('reports input errors by code and keeps the invitation usable', async () => {
    const token = await inviteToken();
    const client = siteClient(app);
    await client.session();
    const cases = [
      [{ username: 'x', password: PASSWORD }, 'username_invalid'],
      [{ username: 'shorty', password: 'short' }, 'password_short'],
      [{ username: 'admin', password: PASSWORD }, 'username_taken'],
    ] as const;
    for (const [body, error] of cases) {
      const res = await client.call('POST', `/invitations/${token}`, body);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error });
    }
    expect((await client.call('GET', `/invitations/${token}`)).statusCode).toBe(204);
  });
});

describe('open signup', () => {
  it('is a 404 when OPEN_SIGNUP is off', async () => {
    const client = siteClient(app);
    await client.session();
    const res = await client.call('POST', '/signup', { username: 'walkin', password: PASSWORD });
    expect(res.statusCode).toBe(404);
  });

  it('creates an account when OPEN_SIGNUP is on', async () => {
    const open = buildApp(testConfig({ openSignup: true }), t.db);
    const client = siteClient(open);
    expect((await client.session()).openSignup).toBe(true);
    const res = await client.call('POST', '/signup', { username: 'walkin', password: PASSWORD });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.username).toBe('walkin');
    await client.session();
    const taken = await client.call('POST', '/signup', { username: 'walkin', password: PASSWORD });
    expect(taken.json()).toEqual({ error: 'username_taken' });
    await open.close();
  });
});

describe('password resets', () => {
  it('shows the account, sets the password and signs out older sessions', async () => {
    await createUser(t.db, { username: 'vega', password: PASSWORD, isAdmin: false, locale: 'en' });
    const older = siteClient(app);
    await older.login('vega', PASSWORD);
    const token = await resetToken('vega');

    const client = siteClient(app);
    await client.session();
    const info = await client.call('GET', `/password-resets/${token}`);
    expect(info.statusCode).toBe(200);
    expect(info.json()).toEqual({ username: 'vega' });

    const short = await client.call('POST', `/password-resets/${token}`, { password: 'short' });
    expect(short.statusCode).toBe(400);
    expect(short.json()).toEqual({ error: 'password_short' });

    const res = await client.call('POST', `/password-resets/${token}`, { password: NEW_PASSWORD });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('vega');
    expect((await client.session()).user?.username).toBe('vega');
    expect((await older.session()).user).toBeNull();
    expect(await verifyCredentials(t.db, 'vega', NEW_PASSWORD)).not.toBeNull();

    const reuse = await client.call('POST', `/password-resets/${token}`, { password: PASSWORD });
    expect(reuse.statusCode).toBe(410);
    expect(reuse.json()).toEqual({ error: 'reset_invalid' });
    expect((await client.call('GET', `/password-resets/${token}`)).statusCode).toBe(410);
  });
});

describe('logs', () => {
  it('never contain invitation or reset tokens', async () => {
    let logs = '';
    const logStream = new Writable({
      write(chunk, _enc, cb) {
        logs += chunk.toString();
        cb();
      },
    });
    const logged = buildApp(config, t.db, { logStream });
    await createUser(t.db, { username: 'logme', password: PASSWORD, isAdmin: false, locale: 'en' });
    const invite = await inviteToken();
    const reset = await resetToken('logme');
    const client = siteClient(logged);
    await client.session();
    await client.call('GET', `/invitations/${invite}`);
    await client.call('POST', `/invitations/${invite}`, { username: 'x', password: 'y' });
    await client.call('GET', `/password-resets/${reset}?x=1`);
    await client.call('POST', `/password-resets/${reset}`, { password: 'short' });
    await logged.close();
    expect(logs).toContain('/api/site/invitations/[redacted]');
    expect(logs).toContain('/api/site/password-resets/[redacted]');
    expect(logs).not.toContain(invite);
    expect(logs).not.toContain(reset);
  });
});
