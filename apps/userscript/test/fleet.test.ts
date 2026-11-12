import { type FleetDispatchObservation, fleetDispatchObservationSchema } from '@app/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFleetCollector } from '../src/collect/fleet';

const account = { serverId: 808, lang: 'en', playerId: 42, playerName: 'Zed' };
const ctx = { account, serverUtcOffsetMinutes: 60 };
const SEND_URL =
  'https://s808-en.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch&action=sendFleet&asJson=1';
const MINI_URL =
  'https://s808-en.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch&action=miniFleet&asJson=1';

type Handler = (e: unknown, xhr: unknown, settings: { url?: string; data?: string }) => void;

function setup(dispatcher: Record<string, unknown> | null = defaultDispatcher()) {
  const handlers: Record<string, Handler[]> = {};
  const win = {
    $: (_t: unknown) => ({
      on: (e: string, h: Handler) => {
        handlers[e] = [...(handlers[e] ?? []), h];
      },
    }),
    fleetDispatcher: dispatcher ?? undefined,
  };
  const onObservations = vi.fn();
  installFleetCollector(win, { doc: document, ctx, onObservations });
  const fire = (event: string, xhr: unknown, settings: { url?: string; data?: string }) => {
    for (const h of handlers[event] ?? []) h({}, xhr, settings);
  };
  return { win, fire, onObservations };
}

function defaultDispatcher(consumption: number = 123) {
  return {
    mission: 15,
    currentPlanet: { galaxy: 1, system: 2, position: 3, type: 1 },
    targetPlanet: { galaxy: 4, system: 5, position: 16, type: 1 },
    shipsToSend: [
      { id: 203, number: 10 },
      { id: 210, number: 2 },
    ],
    getConsumption: () => consumption,
    submitFleet2: () => 'original',
  };
}

const delivered = (fn: ReturnType<typeof vi.fn>, call = 0): FleetDispatchObservation =>
  fn.mock.calls[call]?.[0][0];

describe('installFleetCollector', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('records a successful dispatch with the snapshot consumption', () => {
    const { fire, onObservations } = setup();
    const xhr = { responseText: JSON.stringify({ success: true }) };
    fire('ajaxSend', xhr, { url: SEND_URL });
    fire('ajaxSuccess', xhr, { url: SEND_URL });
    expect(onObservations).toHaveBeenCalledTimes(1);
    const obs = delivered(onObservations);
    expect(fleetDispatchObservationSchema.safeParse(obs).success).toBe(true);
    expect(obs).toMatchObject({
      kind: 'fleet_dispatch',
      source: 'fleetdispatch',
      mission: 15,
      origin: { galaxy: 1, system: 2, position: 3 },
      target: { galaxy: 4, system: 5, position: 16, type: 1 },
      ships: { '203': 10, '210': 2 },
      consumption: 123,
      account,
      serverUtcOffsetMinutes: 60,
    });
    expect(Number.isInteger(obs.sentAt)).toBe(true);
  });

  it('reads the snapshot at send time, not at success time', () => {
    const dispatcher = defaultDispatcher(50);
    const { fire, onObservations } = setup(dispatcher);
    const xhr = { responseJSON: { success: true } };
    fire('ajaxSend', xhr, { url: SEND_URL });
    dispatcher.getConsumption = () => 999;
    dispatcher.mission = 1;
    fire('ajaxSuccess', xhr, { url: SEND_URL });
    expect(delivered(onObservations, 0)).toMatchObject({ consumption: 50, mission: 15 });
  });

  it('records nothing when success is false', () => {
    const { fire, onObservations } = setup();
    const xhr = { responseText: JSON.stringify({ success: false, message: 'limit' }) };
    fire('ajaxSend', xhr, { url: SEND_URL });
    fire('ajaxSuccess', xhr, { url: SEND_URL });
    expect(onObservations).not.toHaveBeenCalled();
  });

  it('records nothing when the response is not valid JSON', () => {
    const { fire, onObservations } = setup();
    const xhr = { responseText: '<html>' };
    fire('ajaxSend', xhr, { url: SEND_URL });
    fire('ajaxSuccess', xhr, { url: SEND_URL });
    expect(onObservations).not.toHaveBeenCalled();
  });

  it('records nothing for an ajaxSend that never succeeds (cancelled)', () => {
    const { fire, onObservations } = setup();
    fire('ajaxSend', {}, { url: SEND_URL });
    expect(onObservations).not.toHaveBeenCalled();
  });

  it('ignores a success without a matching send snapshot', () => {
    const { fire, onObservations } = setup();
    fire('ajaxSuccess', { responseJSON: { success: true } }, { url: SEND_URL });
    expect(onObservations).not.toHaveBeenCalled();
  });

  it('ignores other requests such as checkTarget', () => {
    const { fire, onObservations } = setup();
    const url = SEND_URL.replace('sendFleet', 'checkTarget');
    const xhr = { responseJSON: { success: true } };
    fire('ajaxSend', xhr, { url });
    fire('ajaxSuccess', xhr, { url });
    expect(onObservations).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -5])('turns an unusable consumption (%s) into null', (value) => {
    const { fire, onObservations } = setup(defaultDispatcher(value));
    const xhr = { responseJSON: { success: true } };
    fire('ajaxSend', xhr, { url: SEND_URL });
    fire('ajaxSuccess', xhr, { url: SEND_URL });
    expect(delivered(onObservations, 0).consumption).toBeNull();
  });

  it('truncates a decimal consumption', () => {
    const { fire, onObservations } = setup(defaultDispatcher(12.9));
    const xhr = { responseJSON: { success: true } };
    fire('ajaxSend', xhr, { url: SEND_URL });
    fire('ajaxSuccess', xhr, { url: SEND_URL });
    expect(delivered(onObservations, 0).consumption).toBe(12);
  });

  it('drops a dispatch whose snapshot is invalid (target type unknown)', () => {
    const dispatcher = defaultDispatcher();
    dispatcher.targetPlanet = { galaxy: 4, system: 5, position: 16, type: 9 };
    const { fire, onObservations } = setup(dispatcher);
    const xhr = { responseJSON: { success: true } };
    fire('ajaxSend', xhr, { url: SEND_URL });
    fire('ajaxSuccess', xhr, { url: SEND_URL });
    expect(onObservations).not.toHaveBeenCalled();
  });

  it('does nothing when fleetDispatcher is absent', () => {
    const { fire, onObservations } = setup(null);
    const xhr = { responseJSON: { success: true } };
    fire('ajaxSend', xhr, { url: SEND_URL });
    fire('ajaxSuccess', xhr, { url: SEND_URL });
    expect(onObservations).not.toHaveBeenCalled();
  });

  it('records a successful miniFleet probe with consumption null', () => {
    const { fire, onObservations } = setup(null);
    const xhr = { responseJSON: { response: { success: true } } };
    const data = 'mission=6&galaxy=6&system=4&position=14&type=1&shipCount=20&token=abc';
    fire('ajaxSend', xhr, { url: MINI_URL, data });
    fire('ajaxSuccess', xhr, { url: MINI_URL, data });
    expect(delivered(onObservations, 0)).toMatchObject({
      kind: 'fleet_dispatch',
      source: 'minifleet',
      mission: 6,
      origin: null,
      target: { galaxy: 6, system: 4, position: 14, type: 1 },
      ships: { '210': 20 },
      consumption: null,
    });
  });

  it('maps mission 8 to recyclers and other missions to no ships', () => {
    const { fire, onObservations } = setup(null);
    for (const mission of [8, 1]) {
      const xhr = { responseJSON: { response: { success: true } } };
      const data = `mission=${mission}&galaxy=1&system=1&position=1&type=2&shipCount=3`;
      fire('ajaxSend', xhr, { url: MINI_URL, data });
      fire('ajaxSuccess', xhr, { url: MINI_URL, data });
    }
    expect(delivered(onObservations, 0).ships).toEqual({ '209': 3 });
    expect(delivered(onObservations, 1).ships).toEqual({});
  });

  it('records nothing for a failed miniFleet', () => {
    const { fire, onObservations } = setup(null);
    const xhr = { responseJSON: { success: true, response: { success: false } } };
    const data = 'mission=6&galaxy=6&system=4&position=14&type=1&shipCount=20';
    fire('ajaxSend', xhr, { url: MINI_URL, data });
    fire('ajaxSuccess', xhr, { url: MINI_URL, data });
    expect(onObservations).not.toHaveBeenCalled();
  });

  it('never replaces fleetDispatcher functions', () => {
    const dispatcher = defaultDispatcher();
    const before = dispatcher.submitFleet2;
    const getConsumption = dispatcher.getConsumption;
    setup(dispatcher);
    expect(dispatcher.submitFleet2).toBe(before);
    expect(dispatcher.getConsumption).toBe(getConsumption);
  });

  it('never lets an error escape into the game ajax chain', () => {
    const dispatcher = defaultDispatcher();
    dispatcher.getConsumption = () => {
      throw new Error('boom');
    };
    const { fire, onObservations } = setup(dispatcher);
    const xhr = { responseJSON: { success: true } };
    expect(() => fire('ajaxSend', xhr, { url: SEND_URL })).not.toThrow();
    expect(() => fire('ajaxSuccess', xhr, { url: SEND_URL })).not.toThrow();
    expect(onObservations).not.toHaveBeenCalled();
  });
});
