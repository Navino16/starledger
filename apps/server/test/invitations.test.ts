import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { consumeInvitation, createInvitation, InvitationError } from '../src/users/invitations';
import { createUser, verifyCredentials } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';
import { siteClient, testConfig } from './helpers/site';

const PASSWORD = 'correct horse battery';
const config = testConfig();

let t: TestDb;
let app: FastifyInstance;
let adminId: string;

beforeAll(async () => {
  t = await startTestDb();
  const admin = await createUser(t.db, {
    username: 'admin',
    password: PASSWORD,
    isAdmin: true,
    locale: 'en',
  });
  adminId = admin.id;
  app = buildApp(config, t.db);
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app.close();
  await t.teardown();
});

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

describe('invitation routes', () => {
  it('answer 410 to unknown and expired tokens', async () => {
    const { url } = await createInvitation(t.db, adminId, config.publicUrl, -1);
    const expired = url.split('/invite/')[1] as string;
    const client = siteClient(app);
    await client.session();
    for (const token of ['nope', expired]) {
      const res = await client.call('GET', `/invitations/${token}`);
      expect(res.statusCode).toBe(410);
      expect(res.json()).toEqual({ error: 'invitation_invalid' });
    }
    const post = await client.call('POST', `/invitations/${expired}`, {
      username: 'toolate',
      password: PASSWORD,
    });
    expect(post.statusCode).toBe(410);
    expect(await verifyCredentials(t.db, 'toolate', PASSWORD)).toBeNull();
  });

  it('keep tokens out of the logs on unmatched routes', async () => {
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
    for (const path of [`/invite/${token}/`, `/api/site/invitations/${token}/extra`]) {
      const res = await logged.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'not_found' });
    }
    await logged.close();
    expect(logs).toContain('not found');
    expect(logs).not.toContain(token);
  });
});
