import {
  type AccountRef,
  accountRefSchema,
  computeServerUtcOffsetMinutes,
  dayKey,
} from '@app/shared';

//! AGENTS.md §4: passive read of page data, no game request, no game function called
const UNIVERSE_PATTERN = /^s(\d+)-([a-z]{2,3})\./;

function meta(doc: Document, name: string): string | null {
  return doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
}

export function readAccount(doc: Document): AccountRef | null {
  const universe = UNIVERSE_PATTERN.exec(meta(doc, 'ogame-universe') ?? '');
  const playerId = meta(doc, 'ogame-player-id');
  if (!universe || !playerId || !/^\d+$/.test(playerId)) return null;
  const parsed = accountRefSchema.safeParse({
    serverId: Number(universe[1]),
    lang: universe[2],
    playerId: Number(playerId),
    playerName: meta(doc, 'ogame-player-name') || null,
  });
  return parsed.success ? parsed.data : null;
}

export function readServerUtcOffset(win: { serverTime?: unknown }): number | null {
  const serverTime = win.serverTime;
  // toString check instead of instanceof: the page's Date comes from another realm
  if (Object.prototype.toString.call(serverTime) !== '[object Date]') return null;
  const serverMs = (serverTime as Date).getTime();
  if (Number.isNaN(serverMs)) return null;
  return computeServerUtcOffsetMinutes(serverMs, Date.now(), -new Date().getTimezoneOffset());
}

export function todayKey(win: { serverTime?: unknown }): string | null {
  const offset = readServerUtcOffset(win);
  return offset === null ? null : dayKey(Date.now(), offset);
}
