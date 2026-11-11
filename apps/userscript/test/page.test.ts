import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAccount, readServerUtcOffset, todayKey } from '../src/env/page';

function docWith(metas: Record<string, string>): Document {
  const doc = document.implementation.createHTMLDocument('');
  for (const [name, content] of Object.entries(metas)) {
    const meta = doc.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    doc.head.append(meta);
  }
  return doc;
}

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);

function browserAt(utcOffsetMinutes: number): void {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-utcOffsetMinutes);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('readAccount', () => {
  const full = {
    'ogame-universe': 's123-fr.ogame.gameforge.com',
    'ogame-player-id': '42',
    'ogame-player-name': 'Nathan',
  };

  it('reads server, language, player id and name', () => {
    expect(readAccount(docWith(full))).toEqual({
      serverId: 123,
      lang: 'fr',
      playerId: 42,
      playerName: 'Nathan',
    });
  });

  it('returns null when the universe meta is absent', () => {
    expect(readAccount(docWith({ ...full, 'ogame-universe': undefined as never }))).toBeNull();
    expect(readAccount(docWith({}))).toBeNull();
  });

  it('returns null for a malformed universe', () => {
    expect(readAccount(docWith({ ...full, 'ogame-universe': 'foo.example.com' }))).toBeNull();
    expect(
      readAccount(docWith({ ...full, 'ogame-universe': 's0-fr.ogame.gameforge.com' })),
    ).toBeNull();
  });

  it('returns null when the player id is missing or not a number', () => {
    const { 'ogame-player-id': _id, ...noId } = full;
    expect(readAccount(docWith(noId))).toBeNull();
    expect(readAccount(docWith({ ...full, 'ogame-player-id': 'abc' }))).toBeNull();
    expect(readAccount(docWith({ ...full, 'ogame-player-id': '-3' }))).toBeNull();
  });

  it('gives a null player name when missing or empty', () => {
    const { 'ogame-player-name': _name, ...noName } = full;
    expect(readAccount(docWith(noName))?.playerName).toBeNull();
    expect(readAccount(docWith({ ...full, 'ogame-player-name': '' }))?.playerName).toBeNull();
  });
});

describe('readServerUtcOffset', () => {
  it('computes the offset from serverTime and the browser offset', () => {
    browserAt(-300);
    expect(readServerUtcOffset({ serverTime: new Date(NOW + 6 * 3_600_000) })).toBe(60);
  });

  it('returns null when serverTime is missing or invalid', () => {
    browserAt(0);
    expect(readServerUtcOffset({})).toBeNull();
    expect(readServerUtcOffset({ serverTime: 'nope' })).toBeNull();
    expect(readServerUtcOffset({ serverTime: new Date(Number.NaN) })).toBeNull();
  });
});

describe('todayKey', () => {
  it('uses the server offset to pick the day', () => {
    browserAt(0);
    const win = { serverTime: new Date(NOW + 13 * 3_600_000) };
    expect(todayKey(win)).toBe('2026-11-12');
  });

  it('returns null when the offset is unknown', () => {
    browserAt(0);
    expect(todayKey({})).toBeNull();
  });
});
