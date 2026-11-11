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
  return { ...actual, parseMessage: vi.fn(actual.parseMessage) };
});

let t: TestDb;
let aliceId: string;
let bobId: string;
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
  vi.mocked(shared.parseMessage).mockImplementationOnce(() => ({
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
  const mk = (username: string) =>
    createUser(t.db, { username, password: 'correct horse battery', isAdmin: false, locale: 'en' });
  aliceId = (await mk('alice')).id;
  bobId = (await mk('bob')).id;
}, 120_000);

afterAll(async () => {
  await t.teardown();
});

describe('reparseEvents', () => {
  it('turns an unrecognized event into ok once the parser reads it', async () => {
    const obs = await ingestUnrecognized(aliceId);
    expect((await eventOf(obs)).status).toBe('unrecognized');
    const r = await reparseEvents(t.db, { username: 'alice' });
    expect(r.updated).toBeGreaterThanOrEqual(1);
    const e = await eventOf(obs);
    expect(e.status).toBe('ok');
    expect(e.kind).not.toBeNull();
    expect(e.day).not.toBeNull();
    expect(e.parser_version).toBe(shared.PARSER_VERSION);
  });

  it('leaves an up-to-date ok event untouched', async () => {
    const obs = expedition();
    await send(aliceId, obs);
    const before = await eventOf(obs);
    await reparseEvents(t.db);
    expect(await eventOf(obs)).toEqual(before);
  });

  it('bumps parser_version of an unchanged old event without altering it', async () => {
    const obs = expedition();
    await send(aliceId, obs);
    await setVersion(obs, 0);
    const before = await eventOf(obs);
    const r = await reparseEvents(t.db, { username: 'alice' });
    const after = await eventOf(obs);
    expect(after.parser_version).toBe(shared.PARSER_VERSION);
    expect({ ...after, parser_version: 0 }).toEqual({ ...before, parser_version: 0 });
    const again = await reparseEvents(t.db, { username: 'alice' });
    expect(again).toEqual({ updated: 0, stillUnrecognized: 0, newConflicts: 0, skipped: 0 });
    expect(r.newConflicts).toBe(0);
  });

  it('marks an old ok event as conflict when it now parses differently', async () => {
    const obs = expedition();
    await send(aliceId, obs);
    await setVersion(obs, 0);
    const original = await eventOf(obs);
    const actual = await vi.importActual<typeof import('@app/shared')>('@app/shared');
    vi.mocked(shared.parseMessage).mockImplementationOnce((o) => {
      const res = actual.parseMessage(o);
      if (res.status !== 'ok') return res;
      return { ...res, event: { ...res.event, size: 99 } as typeof res.event };
    });
    const r = await reparseEvents(t.db, { username: 'alice' });
    expect(r.newConflicts).toBe(1);
    const e = await eventOf(obs);
    expect(e.status).toBe('conflict');
    expect(e.data).toEqual(original.data);
    expect(e.parser_version).toBe(shared.PARSER_VERSION);
  });

  it('counts events that stay unrecognized, including when the parser throws', async () => {
    const a = await ingestUnrecognized(aliceId);
    const b = await ingestUnrecognized(aliceId);
    vi.mocked(shared.parseMessage).mockImplementationOnce(() => ({
      status: 'unrecognized',
      externalKey: `msg:${a.msgId}`,
      occurredAt: null,
      reason: 'still',
    }));
    vi.mocked(shared.parseMessage).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const warn = vi.fn();
    const r = await reparseEvents(t.db, { username: 'alice', log: { warn } });
    expect(r.stillUnrecognized).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect((await eventOf(a)).status).toBe('unrecognized');
    expect((await eventOf(b)).status).toBe('unrecognized');
    await reparseEvents(t.db, { username: 'alice' });
  });

  it('limits the run to the given user', async () => {
    const mine = await ingestUnrecognized(aliceId);
    const theirs = await ingestUnrecognized(bobId);
    await reparseEvents(t.db, { username: 'bob' });
    expect((await eventOf(theirs)).status).toBe('ok');
    expect((await eventOf(mine)).status).toBe('unrecognized');
    await reparseEvents(t.db);
    expect((await eventOf(mine)).status).toBe('ok');
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
    await ingestUnrecognized(aliceId);
    const r = await run(['--user', 'alice']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/updated: [1-9]/);
    expect(r.out).toContain('stillUnrecognized: 0');
    expect(r.out).toContain('newConflicts: 0');
  });

  it('exits non-zero on an unknown user', async () => {
    const r = await run(['--user', 'nobody']);
    expect(r.code).toBe(1);
    expect(r.err).toContain('Unknown user "nobody"');
  });

  it('runs for all users without --user', async () => {
    expect((await run([])).code).toBe(0);
  });
});
