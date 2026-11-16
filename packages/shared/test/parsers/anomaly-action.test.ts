import { describe, expect, it } from 'vitest';
import type {
  AnomalyActionObservation,
  FleetDispatchObservation,
  MessageObservation,
} from '../../src/observation';
import { observationExternalKey, parseObservation } from '../../src/parsers';
import { lithiumBonusAmount, parseAnomalyAction } from '../../src/parsers/anomaly-action';

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

describe('lithiumBonusAmount', () => {
  const raw = (message: unknown) => JSON.stringify({ title: 'Du lithium !', message });
  const FR =
    'Quelle heureuse trouvaille\u00a0! Vous avez récupéré un surplus de lithium dans les débris de l`anomalie\u00a0: 3.273.';

  it('reads the only number of the message in either grouping', () => {
    expect(lithiumBonusAmount(raw(FR))).toBe(3273);
    expect(lithiumBonusAmount(raw('You recovered surplus lithium: 3,273.'))).toBe(3273);
    expect(lithiumBonusAmount(raw('Surplus: 12'))).toBe(12);
  });

  it('ignores the digits of HTML entities and tags', () => {
    expect(lithiumBonusAmount(raw('Surplus&#160;:&nbsp;<b class="x2">3.273</b>.'))).toBe(3273);
  });

  it.each([
    ['two numbers', raw('Wave 2: 3.273')],
    ['no number', raw('Lithium!')],
    ['invalid json', '{'],
    ['no message', JSON.stringify({ title: 'x' })],
    ['numeric message', raw(3273)],
    ['null raw', null],
  ])('is unknown with %s', (_name, value) => {
    expect(lithiumBonusAmount(value)).toBeNull();
  });

  it('reads the bonus of a collect from its raw JSON, keeping a known one', () => {
    const event = (o: Partial<AnomalyActionObservation>) => {
      const r = parseAnomalyAction({ ...action, ...o });
      return r.status === 'ok' && r.event.kind === 'anomaly_action' ? r.event.lithiumBonus : 'x';
    };
    expect(event({ lithiumBonus: null, lithiumBonusRaw: raw(FR) })).toBe(3273);
    expect(event({ lithiumBonus: 0, lithiumBonusRaw: null })).toBe(0);
    expect(event({ lithiumBonus: null, lithiumBonusRaw: null })).toBeNull();
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
