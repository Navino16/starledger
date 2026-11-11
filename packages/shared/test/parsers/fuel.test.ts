import { describe, expect, it } from 'vitest';
import type { FleetDispatchObservation } from '../../src/observation';
import { parseFleetDispatch } from '../../src/parsers/fuel';

const base: FleetDispatchObservation = {
  kind: 'fleet_dispatch',
  clientObservationId: '7f9c24e8-3b12-4f4e-9c1a-2d5b6a7e8f90',
  account: { serverId: 808, lang: 'en', playerId: 1, playerName: null },
  observedAt: 1_700_000_100_000,
  serverUtcOffsetMinutes: 60,
  source: 'fleetdispatch',
  mission: 15,
  origin: { galaxy: 1, system: 2, position: 3 },
  target: { galaxy: 1, system: 2, position: 16, type: 1 },
  ships: { '203': 5 },
  consumption: 1234.7,
  sentAt: 1_700_000_000_000,
};

describe('parseFleetDispatch', () => {
  it('builds a fuel event with the truncated consumption', () => {
    expect(parseFleetDispatch(base)).toEqual({
      status: 'ok',
      externalKey: `fuel:${base.clientObservationId}`,
      occurredAt: base.sentAt,
      event: {
        kind: 'fuel',
        source: 'fleetdispatch',
        mission: 15,
        origin: base.origin,
        target: base.target,
        ships: base.ships,
        consumption: 1234,
      },
    });
  });

  it('keeps unknown consumption as null', () => {
    const r = parseFleetDispatch({ ...base, consumption: null });
    expect(r.status === 'ok' && r.event.kind === 'fuel' ? r.event.consumption : 'bad').toBeNull();
  });
});
