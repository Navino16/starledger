import {
  type AccountRef,
  type MessageObservation,
  messageObservationSchema,
  TRACKED_MESSAGE_TYPES,
} from '@app/shared';

export type ExtractContext = {
  account: AccountRef;
  serverUtcOffsetMinutes: number;
  subtabId?: number | null;
};

const TRACKED: readonly number[] = TRACKED_MESSAGE_TYPES;

function toInt(value: string | null | undefined): number | null {
  return value !== null && value !== undefined && /^-?\d+$/.test(value.trim())
    ? Number(value.trim())
    : null;
}

function readRaw(el: HTMLElement | null): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(el?.dataset ?? {})) {
    if (value !== undefined && /^raw[A-Z]/.test(key)) raw[key.slice(3).toLowerCase()] = value;
  }
  return raw;
}

const ANOMALY_REWARD_TYPE = 76;

function lootAmount(el: Element): number | null {
  const description = el.getAttribute('aria-description') ?? '';
  return toInt(description.slice(description.lastIndexOf(':') + 1));
}

function readLootItem(item: Element): Record<string, unknown> | null {
  const icon = item.querySelector('resource-icon, technology-icon, [aria-description]');
  if (!icon) return null;
  const tag = icon.tagName.toLowerCase();
  const amount = lootAmount(icon);
  if (tag === 'resource-icon') {
    return { type: 'resource', resource: icon.classList[0] ?? '', amount };
  }
  if (tag === 'technology-icon') {
    const attributes = icon
      .getAttributeNames()
      .filter((name) => icon.getAttribute(name) === '')
      .map((name) => name.toLowerCase());
    return { type: 'ship', attributes, amount };
  }
  return { type: 'unknown', tag, amount };
}

function readAnomalyReward(msg: HTMLElement, raw: Record<string, string>): void {
  const items = [...msg.querySelectorAll('.content-box .loot-item')]
    .map(readLootItem)
    .filter((item) => item !== null);
  if (items.length > 0) raw['x-loot'] = JSON.stringify(items);
  const link = msg.querySelector('.msgContent a.txt_link')?.textContent ?? '';
  const coords = /\[(\d+):(\d+):(\d+)\]/.exec(link);
  if (coords) raw['x-anomalycoords'] = `${coords[1]}:${coords[2]}:${coords[3]}`;
}

export function extractMessageObservations(
  root: ParentNode,
  ctx: ExtractContext,
): MessageObservation[] {
  const subtabId =
    ctx.subtabId !== undefined
      ? ctx.subtabId
      : toInt(
          root.querySelector<HTMLElement>('.innerTabItem.active[data-subtab-id]')?.dataset.subtabId,
        );
  const result: MessageObservation[] = [];
  for (const msg of root.querySelectorAll<HTMLElement>('div.msg[data-msg-id]')) {
    const raw = readRaw(msg.querySelector<HTMLElement>('.rawMessageData'));
    const messageType = toInt(raw.messagetype);
    if (messageType === null || !TRACKED.includes(messageType)) continue;
    //! AGENTS.md §4: passive read of the message the player opened, no game request
    if (messageType === ANOMALY_REWARD_TYPE) readAnomalyReward(msg, raw);
    const parsed = messageObservationSchema.safeParse({
      kind: 'message',
      clientObservationId: crypto.randomUUID(),
      account: ctx.account,
      observedAt: Date.now(),
      serverUtcOffsetMinutes: ctx.serverUtcOffsetMinutes,
      msgId: toInt(msg.dataset.msgId),
      messageType,
      subtabId,
      raw,
    });
    if (parsed.success) result.push(parsed.data);
  }
  return result;
}

export type AjaxSettings = { url?: unknown; data?: unknown };
export type AjaxHandler = (event: unknown, xhr: unknown, settings: AjaxSettings) => void;

export type PageWindow = {
  $?: (target: unknown) => { on(event: string, handler: AjaxHandler): unknown };
  ogame?: { messages?: { content?: unknown } };
};

function isMessagesListRequest(settings: AjaxSettings): boolean {
  if (typeof settings?.url !== 'string') return false;
  let url: URL;
  try {
    url = new URL(settings.url, 'https://invalid.example');
  } catch {
    return false;
  }
  if (url.searchParams.get('action') !== 'getMessagesList') return false;
  const body = typeof settings.data === 'string' ? new URLSearchParams(settings.data) : null;
  return url.searchParams.get('showTrash') !== 'true' && body?.get('showTrash') !== 'true';
}

export type CollectorDeps = {
  doc: Document;
  ctx: ExtractContext;
  onObservations: (observations: MessageObservation[]) => void;
};

export function installMessageCollector(win: PageWindow, deps: CollectorDeps): void {
  const { doc } = deps;
  const seen = new Set<number>();

  const deliver = (observations: MessageObservation[]) => {
    const fresh: MessageObservation[] = [];
    for (const o of observations) {
      if (seen.has(o.msgId)) continue;
      seen.add(o.msgId);
      fresh.push(o);
    }
    if (fresh.length > 0) deps.onObservations(fresh);
  };

  //! AGENTS.md §4: our errors must never break the game's ajax chain
  try {
    deliver(extractMessageObservations(doc, deps.ctx));
  } catch {}

  //! AGENTS.md §4: passive read of a player-triggered response, no game request
  win.$?.(doc).on('ajaxSuccess', (_event, _xhr, settings) => {
    //! AGENTS.md §4: our errors must never break the game's ajax chain
    try {
      if (!isMessagesListRequest(settings)) return;
      const content = win.ogame?.messages?.content;
      if (!Array.isArray(content)) return;
      const root = new DOMParser().parseFromString(content.join(''), 'text/html');
      const body = typeof settings.data === 'string' ? new URLSearchParams(settings.data) : null;
      const subtabId =
        toInt(body?.get('activeSubTab')) ??
        toInt(
          doc.querySelector<HTMLElement>('.innerTabItem.active[data-subtab-id]')?.dataset.subtabId,
        );
      deliver(extractMessageObservations(root, { ...deps.ctx, subtabId }));
    } catch {}
  });
}
