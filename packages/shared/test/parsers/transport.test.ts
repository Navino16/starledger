import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTransport } from '../../src/parsers/transport';
import { loadFixtures, observationOf, withRaw } from './helpers';

const fixtures = loadFixtures('transport-', join(import.meta.dirname, '../fixtures/messages-real'));
const delivered = observationOf(fixtures, 'transport-delivered.json');
const received = observationOf(fixtures, 'transport-received.json');
const internal = observationOf(fixtures, 'transport-internal.json');

const eventOf = (r: ReturnType<typeof parseTransport>) => (r.status === 'ok' ? r.event : null);

describe('parseTransport', () => {
  it.each(fixtures.map((f) => [f.file, f] as const))('%s matches expected', (_n, f) => {
    expect(parseTransport(f.observation)).toEqual(f.expected);
  });

  it('tells the three directions apart', () => {
    expect(eventOf(parseTransport(delivered))).toMatchObject({ direction: 'delivered' });
    expect(eventOf(parseTransport(received))).toMatchObject({ direction: 'received' });
    expect(eventOf(parseTransport(internal))).toMatchObject({ direction: 'internal' });
  });

  it('carries no counterpart identity nor coordinates', () => {
    expect(Object.keys(eventOf(parseTransport(delivered)) ?? {}).sort()).toEqual([
      'direction',
      'kind',
      'resources',
    ]);
  });

  it('ignores food and unknown cargo keys', () => {
    const obs = withRaw(delivered, {
      cargo: '{"metal":5,"crystal":6,"deuterium":7,"food":9,"x":1}',
    });
    expect(eventOf(parseTransport(obs))).toMatchObject({
      resources: { metal: 5, crystal: 6, deuterium: 7 },
    });
  });

  it('treats an absent resource key as 0', () => {
    const obs = withRaw(delivered, { cargo: '{"crystal":6}' });
    expect(eventOf(parseTransport(obs))).toMatchObject({
      resources: { metal: 0, crystal: 6, deuterium: 0 },
    });
  });

  it.each([
    ['missing cargo', { cargo: undefined }],
    ['invalid cargo JSON', { cargo: '{' }],
    ['negative amount', { cargo: '{"metal":-1}' }],
    ['decimal amount', { cargo: '{"metal":1.5}' }],
    ['missing source player id', { sourceplayerid: undefined }],
    ['missing target player id', { targetplayerid: undefined }],
    ['invalid player id', { sourceplayerid: 'x' }],
    ['neither player own', { sourceplayerid: '200001', targetplayerid: '200002' }],
  ])('is unrecognized with %s', (_n, patch) => {
    expect(parseTransport(withRaw(delivered, patch)).status).toBe('unrecognized');
  });

  it('is unrecognized without timestamp', () => {
    expect(parseTransport(withRaw(delivered, { timestamp: undefined }))).toMatchObject({
      status: 'unrecognized',
      occurredAt: null,
    });
  });
});
