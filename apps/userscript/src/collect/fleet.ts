import { type FleetDispatchObservation, fleetDispatchObservationSchema } from '@app/shared';
import type { AjaxSettings, ExtractContext, PageWindow } from './messages';

type Snapshot = Pick<
  FleetDispatchObservation,
  'source' | 'mission' | 'origin' | 'target' | 'ships' | 'consumption'
>;

export type FleetPageWindow = PageWindow & {
  fleetDispatcher?: {
    mission?: unknown;
    currentPlanet?: unknown;
    targetPlanet?: unknown;
    shipsToSend?: unknown;
    getConsumption?: () => unknown;
  };
};

export type FleetCollectorDeps = {
  doc: Document;
  ctx: ExtractContext;
  onObservations: (observations: FleetDispatchObservation[]) => void;
};

const PROBES = '210';
const RECYCLERS = '209';

function action(settings: AjaxSettings): string | null {
  if (typeof settings?.url !== 'string') return null;
  try {
    return new URL(settings.url, 'https://invalid.example').searchParams.get('action');
  } catch {
    return null;
  }
}

function num(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function coords(value: unknown): { galaxy: number; system: number; position: number } | null {
  const c = (value ?? {}) as Record<string, unknown>;
  const galaxy = num(c.galaxy);
  const system = num(c.system);
  const position = num(c.position);
  return galaxy === null || system === null || position === null
    ? null
    : { galaxy, system, position };
}

// Unknown is not 0: a non-finite or negative consumption stays null (data-formats §6.1).
function toConsumption(value: unknown): number | null {
  const n = num(value);
  return n !== null && n >= 0 ? Math.floor(n) : null;
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

export function installFleetCollector(win: FleetPageWindow, deps: FleetCollectorDeps): void {
  const { doc, ctx } = deps;
  const snapshots = new WeakMap<object, Snapshot>();

  const snapshotDispatch = (): Snapshot | null => {
    //! AGENTS.md §0/§4: observe only, never wrap or replace fleetDispatcher
    const fd = win.fleetDispatcher;
    if (!fd) return null;
    const mission = num(fd.mission);
    const target = coords(fd.targetPlanet);
    if (mission === null || target === null) return null;
    const ships: Record<string, number> = {};
    if (Array.isArray(fd.shipsToSend)) {
      for (const s of fd.shipsToSend as { id?: unknown; number?: unknown }[]) {
        const id = num(s?.id);
        const amount = num(s?.number);
        if (id !== null && amount !== null && amount > 0) ships[String(id)] = amount;
      }
    }
    return {
      source: 'fleetdispatch',
      mission,
      origin: coords(fd.currentPlanet),
      target: { ...target, type: num((fd.targetPlanet as { type?: unknown }).type) as 1 | 2 | 3 },
      ships,
      consumption: toConsumption(fd.getConsumption?.()),
    };
  };

  const snapshotMini = (settings: AjaxSettings): Snapshot | null => {
    if (typeof settings.data !== 'string') return null;
    const body = new URLSearchParams(settings.data);
    const mission = num(body.get('mission'));
    const target = coords({
      galaxy: body.get('galaxy'),
      system: body.get('system'),
      position: body.get('position'),
    });
    if (mission === null || target === null) return null;
    const shipCount = num(body.get('shipCount'));
    const ships: Record<string, number> = {};
    if (shipCount !== null && mission === 6) ships[PROBES] = shipCount;
    else if (shipCount !== null && mission === 8) ships[RECYCLERS] = shipCount;
    return {
      source: 'minifleet',
      mission,
      origin: null,
      target: { ...target, type: num(body.get('type')) as 1 | 2 | 3 },
      ships,
      consumption: null,
    };
  };

  //! AGENTS.md §4: passive read of a player-triggered request, no game request
  win.$?.(doc).on('ajaxSend', (_event, xhr, settings) => {
    //! AGENTS.md §4: our errors must never break the game's ajax chain
    try {
      if (xhr === null || typeof xhr !== 'object') return;
      const kind = action(settings);
      const snapshot =
        kind === 'sendFleet'
          ? snapshotDispatch()
          : kind === 'miniFleet'
            ? snapshotMini(settings)
            : null;
      if (snapshot) snapshots.set(xhr, snapshot);
    } catch {}
  });

  //! AGENTS.md §4: passive read of a player-triggered response, no game request
  win.$?.(doc).on('ajaxSuccess', (_event, xhr) => {
    //! AGENTS.md §4: our errors must never break the game's ajax chain
    try {
      if (xhr === null || typeof xhr !== 'object') return;
      const snapshot = snapshots.get(xhr);
      if (!snapshot) return;
      snapshots.delete(xhr);
      const body = readResponse(xhr);
      const ok =
        snapshot.source === 'minifleet'
          ? (body?.response as { success?: unknown } | undefined)?.success === true
          : body?.success === true;
      if (!ok) return;
      const now = Date.now();
      const parsed = fleetDispatchObservationSchema.safeParse({
        kind: 'fleet_dispatch',
        clientObservationId: crypto.randomUUID(),
        account: ctx.account,
        observedAt: now,
        serverUtcOffsetMinutes: ctx.serverUtcOffsetMinutes,
        sentAt: now,
        ...snapshot,
      });
      if (parsed.success) deps.onObservations([parsed.data]);
    } catch {}
  });
}
