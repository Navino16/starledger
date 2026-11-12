import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import type { MessageObservation } from '@app/shared';
import * as shared from '@app/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli';
import { ingestBatch } from '../src/ingest/ingest';
import { reparseEvents } from '../src/ingest/reparse';
import { createUser } from '../src/users/users';
import { startTestDb, type TestDb } from './helpers/db';

vi.mock('@app/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/shared')>();
  return { ...actual, parseObservation: vi.fn(actual.parseObservation) };
});

let t: TestDb;
let userSeq = 0;
let nextMsgId = 50_000;

function expedition(rawPatch: Record<string, string> = {}): MessageObservation {
  return {
    kind: 'message',
    clientObservationId: randomUUID(),
    account: { serverId: 808, lang: 'en', playerId: 100001, playerName: 'Tester' },
    observedAt: 1_790_000_160_000,
    serverUtcOffsetMinutes: 60,
    msgId: nextMsgId++,
    messageType: 41,
    subtabId: 22,
    raw: {
      messagetype: '41',
      timestamp: '1790000100',
      coords: '4:100:16',
      expeditionresult: 'ressources',
      size: '2',
      depletion: '1',
      resourcesgained: '{"metal":1200,"crystal":600}',
      ...rawPatch,
    },
  };
}

const send = (userId: string, obs: MessageObservation) =>
  ingestBatch(t.db, userId, {
    clientVersion: '0.1.0',
    deviceId: randomUUID(),
    observations: [obs],
  });

async function freshUser() {
  const username = `user${userSeq++}`;
  const user = await createUser(t.db, {
    username,
    password: 'correct horse battery',
    isAdmin: false,
    locale: 'en',
  });
  return { id: user.id, username };
}

const NONE = { updated: 0, stillUnrecognized: 0, newConflicts: 0, skipped: 0 };

const eventOf = (obs: MessageObservation) =>
  t.db
    .selectFrom('events')
    .selectAll()
    .where('external_key', '=', `msg:${obs.msgId}`)
    .executeTakeFirstOrThrow();

const setVersion = (obs: MessageObservation, v: number) =>
  t.db
    .updateTable('events')
    .set({ parser_version: v })
    .where('external_key', '=', `msg:${obs.msgId}`)
    .execute();

// Makes the real parser fail for one ingest only, leaving an unrecognized event.
async function ingestUnrecognized(userId: string): Promise<MessageObservation> {
  const obs = expedition();
  vi.mocked(shared.parseObservation).mockImplementationOnce(() => ({
    status: 'unrecognized',
    externalKey: `msg:${obs.msgId}`,
    occurredAt: null,
    reason: 'unknown',
  }));
  await send(userId, obs);
  return obs;
}

const sink = () => {
  let text = '';
  return {
    stream: new Writable({
      write(c, _e, cb) {
        text += c.toString();
        cb();
      },
    }),
    text: () => text,
  };
};

beforeAll(async () => {
  t = await startTestDb();
}, 120_000);

afterAll(async () => {
  await t.teardown();
});

const unrecognizedOnce = (obs: MessageObservation) =>
  vi.mocked(shared.parseObservation).mockImplementationOnce(() => ({
    status: 'unrecognized',
    externalKey: `msg:${obs.msgId}`,
    occurredAt: null,
    reason: 'still',
  }));

async function differentReadingOnce() {
  const actual = await vi.importActual<typeof import('@app/shared')>('@app/shared');
  vi.mocked(shared.parseObservation).mockImplementationOnce((o) => {
    const res = actual.parseObservation(o);
    if (res.status !== 'ok') return res;
    return { ...res, event: { ...res.event, size: 99 } as typeof res.event };
  });
}

describe('reparseEvents', () => {
  it('turns an unrecognized event into ok once the parser reads it', async () => {
    const u = await freshUser();
    const obs = await ingestUnrecognized(u.id);
    expect((await eventOf(obs)).status).toBe('unrecognized');
    expect(await reparseEvents(t.db, { username: u.username })).toEqual({ ...NONE, updated: 1 });
    const e = await eventOf(obs);
    expect(e.status).toBe('ok');
    expect(e.kind).not.toBeNull();
    expect(e.day).not.toBeNull();
    expect(e.parser_version).toBe(shared.PARSER_VERSION);
  });

  it('leaves an up-to-date ok event untouched', async () => {
    const u = await freshUser();
    const obs = expedition();
    await send(u.id, obs);
    const before = await eventOf(obs);
    expect(await reparseEvents(t.db, { username: u.username })).toEqual(NONE);
    expect(await eventOf(obs)).toEqual(before);
  });

  it('bumps parser_version of an unchanged old event without altering it', async () => {
    const u = await freshUser();
    const obs = expedition();
    await send(u.id, obs);
    await setVersion(obs, 0);
    const before = await eventOf(obs);
    expect(await reparseEvents(t.db, { username: u.username })).toEqual(NONE);
    const after = await eventOf(obs);
    expect(after.parser_version).toBe(shared.PARSER_VERSION);
    expect({ ...after, parser_version: 0 }).toEqual({ ...before, parser_version: 0 });
  });

  it('replaces an old ok event that now parses differently, without a conflict', async () => {
    const u = await freshUser();
    const obs = expedition();
    await send(u.id, obs);
    await setVersion(obs, 0);
    await differentReadingOnce();
    expect(await reparseEvents(t.db, { username: u.username })).toEqual({ ...NONE, updated: 1 });
    const e = await eventOf(obs);
    expect(e.status).toBe('ok');
    expect(e.data).toMatchObject({ size: 99 });
    expect(e.parser_version).toBe(shared.PARSER_VERSION);
  });

  it('replaces a conflict event with the valid re-read of its source observation', async () => {
    const u = await freshUser();
    const obs = expedition();
    await send(u.id, obs);
    const other = { ...expedition({ resourcesgained: '{"metal":5}' }), msgId: obs.msgId };
    expect((await send(u.id, other)).results[0]?.status).toBe('conflict');
    expect((await eventOf(obs)).status).toBe('conflict');
    await setVersion(obs, 0);
    expect(await reparseEvents(t.db, { username: u.username })).toEqual({ ...NONE, updated: 1 });
    const e = await eventOf(obs);
    expect(e.status).toBe('ok');
    expect(e.data).toMatchObject({ kind: 'expedition' });
  });

  it('keeps an old ok event that now reads as unrecognized and counts nothing', async () => {
    const u = await freshUser();
    const obs = expedition();
    await send(u.id, obs);
    await setVersion(obs, 0);
    const before = await eventOf(obs);
    unrecognizedOnce(obs);
    expect(await reparseEvents(t.db, { username: u.username })).toEqual(NONE);
    const after = await eventOf(obs);
    expect(after.status).toBe('ok');
    expect(after.data).toEqual(before.data);
    expect(after.parser_version).toBe(shared.PARSER_VERSION);
  });

  it('counts events that stay unrecognized, including when the parser throws', async () => {
    const u = await freshUser();
    const a = await ingestUnrecognized(u.id);
    const b = await ingestUnrecognized(u.id);
    unrecognizedOnce(a);
    vi.mocked(shared.parseObservation).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const warn = vi.fn();
    const r = await reparseEvents(t.db, { username: u.username, log: { warn } });
    expect(r).toEqual({ ...NONE, stillUnrecognized: 2 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect((await eventOf(a)).status).toBe('unrecognized');
    expect((await eventOf(b)).status).toBe('unrecognized');
  });

  it('limits the run to the given user', async () => {
    const alice = await freshUser();
    const bob = await freshUser();
    const mine = await ingestUnrecognized(alice.id);
    const theirs = await ingestUnrecognized(bob.id);
    expect(await reparseEvents(t.db, { username: bob.username })).toEqual({ ...NONE, updated: 1 });
    expect((await eventOf(theirs)).status).toBe('ok');
    expect((await eventOf(mine)).status).toBe('unrecognized');
    expect((await reparseEvents(t.db)).updated).toBeGreaterThanOrEqual(1);
    expect((await eventOf(mine)).status).toBe('ok');
  });

  it('skips an event the database rejects and continues the run', async () => {
    const u = await freshUser();
    const bad = await ingestUnrecognized(u.id);
    const good = await ingestUnrecognized(u.id);
    vi.mocked(shared.parseObservation).mockImplementationOnce(() => {
      return {
        status: 'ok',
        externalKey: `msg:${bad.msgId}`,
        occurredAt: 1_790_000_100_000,
        // jsonb rejects \u0000 with SQLSTATE 22P05 (data error class)
        event: { kind: 'expedition', note: '\u0000' } as never,
      };
    });
    const warn = vi.fn();
    const r = await reparseEvents(t.db, { username: u.username, log: { warn } });
    expect(r).toEqual({ ...NONE, updated: 1, skipped: 1 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect((await eventOf(bad)).status).toBe('unrecognized');
    expect((await eventOf(good)).status).toBe('ok');
  });

  it('aborts on a non-data error', async () => {
    const u = await freshUser();
    await ingestUnrecognized(u.id);
    const failing = t.db.withPlugin({
      transformQuery(args) {
        if (args.node.kind === 'UpdateQueryNode') throw new Error('connection lost');
        return args.node;
      },
      transformResult: async (args) => args.result,
    });
    await expect(reparseEvents(failing, { username: u.username })).rejects.toThrow(
      'connection lost',
    );
  });

  it('rejects an unknown user', async () => {
    await expect(reparseEvents(t.db, { username: 'nobody' })).rejects.toThrow(/nobody/);
  });
});

describe('runCli reparse', () => {
  const run = async (args: string[]) => {
    const out = sink();
    const err = sink();
    const code = await runCli(['reparse', ...args], {
      stdin: Readable.from([]),
      stdout: out.stream,
      stderr: err.stream,
      db: t.db,
    });
    return { code, out: out.text(), err: err.text() };
  };

  it('prints the counters', async () => {
    const u = await freshUser();
    await ingestUnrecognized(u.id);
    const r = await run(['--user', u.username]);
    expect(r.code).toBe(0);
    expect(r.out).toBe('updated: 1\nstillUnrecognized: 0\nnewConflicts: 0\nskipped: 0\n');
  });

  it('exits non-zero on an unknown user', async () => {
    const r = await run(['--user', 'nobody']);
    expect(r.code).toBe(1);
    expect(r.err).toContain('Unknown user "nobody"');
  });

  it('exits non-zero on a non-data error', async () => {
    const u = await freshUser();
    await ingestUnrecognized(u.id);
    const err = sink();
    const failing = t.db.withPlugin({
      transformQuery(args) {
        if (args.node.kind === 'UpdateQueryNode') throw new Error('connection lost');
        return args.node;
      },
      transformResult: async (args) => args.result,
    });
    const code = await runCli(['reparse', '--user', u.username], {
      stdin: Readable.from([]),
      stdout: sink().stream,
      stderr: err.stream,
      db: failing,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain('connection lost');
  });

  it('runs for all users without --user', async () => {
    expect((await run([])).code).toBe(0);
  });
});
