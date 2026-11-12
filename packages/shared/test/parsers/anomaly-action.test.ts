import { describe, expect, it } from 'vitest';
import type {
  AnomalyActionObservation,
  FleetDispatchObservation,
  MessageObservation,
} from '../../src/observation';
import { observationExternalKey, parseObservation } from '../../src/parsers';
import { parseAnomalyAction } from '../../src/parsers/anomaly-action';

const id = '7f9c24e8-3b12-4f4e-9c1a-2d5b6a7e8f90';
const account = { serverId: 808, lang: 'en', playerId: 1, playerName: null };

const action: AnomalyActionObservation = {
  kind: 'anomaly_action',
  clientObservationId: id,
  account,
  observedAt: 1_700_000_100_000,
  serverUtcOffsetMinutes: 60,
  action: 'collect_dm',
  lithium: 9906,
  darkMatter: 590,
  lithiumBonus: null,
  lithiumBonusRaw: '{"title":"x"}',
  actedAt: 1_700_000_000_000,
};

const dispatch: FleetDispatchObservation = {
  kind: 'fleet_dispatch',
  clientObservationId: id,
  account,
  observedAt: 1_700_000_100_000,
  serverUtcOffsetMinutes: 60,
  source: 'fleetdispatch',
  mission: 15,
  origin: null,
  target: { galaxy: 1, system: 2, position: 16, type: 1 },
  ships: {},
  consumption: 1,
  sentAt: 1_700_000_000_000,
};

describe('parseAnomalyAction', () => {
  it('builds an anomaly_action event keyed by the observation id', () => {
    expect(parseAnomalyAction(action)).toEqual({
      status: 'ok',
      externalKey: `anomaly:${id}`,
      occurredAt: action.actedAt,
      event: {
        kind: 'anomaly_action',
        action: 'collect_dm',
        lithium: 9906,
        darkMatter: 590,
        lithiumBonus: null,
      },
    });
  });
});

describe('parseObservation and observationExternalKey', () => {
  const message: MessageObservation = {
    kind: 'message',
    clientObservationId: id,
    account,
    observedAt: 1_700_000_100_000,
    serverUtcOffsetMinutes: 60,
    msgId: 77,
    messageType: 99,
    subtabId: null,
    raw: {},
  };

  it('routes each kind to its parser', () => {
    expect(parseObservation(message).externalKey).toBe('msg:77');
    expect(parseObservation(dispatch)).toMatchObject({ event: { kind: 'fuel' } });
    expect(parseObservation(action)).toMatchObject({ event: { kind: 'anomaly_action' } });
  });

  it('gives the external key of each kind', () => {
    expect(observationExternalKey(message)).toBe('msg:77');
    expect(observationExternalKey(dispatch)).toBe(`fuel:${id}`);
    expect(observationExternalKey(action)).toBe(`anomaly:${id}`);
  });
});
