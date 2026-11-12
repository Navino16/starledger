import { type AnomalyActionObservation, anomalyActionObservationSchema } from '@app/shared';
import type { AjaxSettings, ExtractContext, PageWindow } from './messages';

type Action = AnomalyActionObservation['action'];
type Snapshot = { action: Action; lithium: number | null; darkMatter: number | null };

export type AnomalyCollectorDeps = {
  doc: Document;
  ctx: ExtractContext;
  onObservations: (observations: AnomalyActionObservation[]) => void;
};

const ACTIONS: Record<string, Action> = {
  performScan: 'scan',
  collectRewards: 'collect',
  collectRewardsWithDarkMatter: 'collect_dm',
};
const MAX_RAW = 4000;

function parseUrl(settings: AjaxSettings): URL | null {
  if (typeof settings?.url !== 'string') return null;
  try {
    return new URL(settings.url, 'https://invalid.example');
  } catch {
    return null;
  }
}

function digits(text: string | null | undefined): number | null {
  const d = (text ?? '').replace(/\D/g, '');
  return d === '' ? null : Number(d);
}

function wholeNumber(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function param(data: unknown, key: string): string | null {
  if (typeof data === 'string') return new URLSearchParams(data).get(key);
  if (data !== null && typeof data === 'object') {
    const v = (data as Record<string, unknown>)[key];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : null;
  }
  return null;
}

function readResponse(xhr: unknown): Record<string, unknown> | null {
  const x = xhr as { responseJSON?: unknown; responseText?: unknown } | null;
  let body: unknown = x?.responseJSON;
  if (body === undefined && typeof x?.responseText === 'string') {
    try {
      body = JSON.parse(x.responseText);
    } catch {
      return null;
    }
  }
  return body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : null;
}

export function installAnomalyCollector(win: PageWindow, deps: AnomalyCollectorDeps): void {
  const { doc, ctx } = deps;
  const snapshots = new WeakMap<object, Snapshot>();

  const overlay = (selector: string, spaceObjectId: string | null): Element | null =>
    Array.from(doc.querySelectorAll(selector)).find(
      (el) => el.getAttribute('data-space-object-id') === spaceObjectId,
    ) ?? null;

  const scanCost = (): number | null => {
    const fromData = wholeNumber(win.$?.('#scanCostValue').data?.('value'));
    if (fromData !== null) return fromData;
    return digits(doc.querySelector('#scanCostValue')?.getAttribute('data-tooltip-title'));
  };

  const snapshotOf = (action: Action, settings: AjaxSettings): Snapshot => {
    const spaceObjectId = param(settings.data, 'spaceObjectId');
    if (action === 'scan') return { action, lithium: scanCost(), darkMatter: null };
    if (action === 'collect') {
      const box = overlay(
        'div.orionCollectRewards:not(.orionCollectRewardsDarkMatter)',
        spaceObjectId,
      );
      return {
        action,
        lithium: digits(box?.querySelector('.collectTotalValue')?.textContent),
        darkMatter: null,
      };
    }
    const price = param(settings.data, 'darkMatterPrice');
    const fromRequest = price !== null && /^\d+$/.test(price) ? Number(price) : null;
    const box = overlay('div.orionCollectRewardsDarkMatter', spaceObjectId);
    const balance = doc
      .querySelector('.orionLithiumAmount[data-value]')
      ?.getAttribute('data-value');
    return {
      action,
      darkMatter: fromRequest ?? wholeNumber(box?.getAttribute('data-dark-matter-price')),
      lithium: wholeNumber(balance),
    };
  };

  //! AGENTS.md §4: observe the player's own requests; never call fetchScanCost or fetchCurrentLithium
  win.$?.(doc).on('ajaxSend', (_event, xhr, settings) => {
    //! AGENTS.md §4: our errors must never break the game's ajax chain
    try {
      if (xhr === null || typeof xhr !== 'object') return;
      const url = parseUrl(settings);
      if (url?.searchParams.get('component') !== 'orion') return;
      const action = ACTIONS[url.searchParams.get('action') ?? ''];
      if (action) snapshots.set(xhr, snapshotOf(action, settings));
    } catch {}
  });

  //! AGENTS.md §0/§4: observe only, never wrap or replace the game's handlers
  win.$?.(doc).on('ajaxSuccess', (_event, xhr) => {
    //! AGENTS.md §4: our errors must never break the game's ajax chain
    try {
      if (xhr === null || typeof xhr !== 'object') return;
      const snapshot = snapshots.get(xhr);
      if (!snapshot) return;
      snapshots.delete(xhr);
      const body = readResponse(xhr);
      if (body?.status !== 'success') return;
      const bonus = snapshot.action === 'scan' ? null : (body.lithiumBonus ?? null);
      const raw = bonus === null ? null : JSON.stringify(bonus);
      const now = Date.now();
      const parsed = anomalyActionObservationSchema.safeParse({
        kind: 'anomaly_action',
        clientObservationId: crypto.randomUUID(),
        account: ctx.account,
        observedAt: now,
        serverUtcOffsetMinutes: ctx.serverUtcOffsetMinutes,
        ...snapshot,
        lithiumBonus: bonus === null ? 0 : null,
        lithiumBonusRaw: raw !== null && raw.length <= MAX_RAW ? raw : null,
        actedAt: now,
      });
      if (parsed.success) deps.onObservations([parsed.data]);
    } catch {}
  });
}
