import { describe, expect, it } from 'vitest';
import { parseExpedition } from '../../src/parsers/expedition';
import { loadFixtures, observationOf, withRaw } from './helpers';

const fixtures = loadFixtures('expedition-');
const base = observationOf(fixtures, 'expedition-resources.json');
const ships = observationOf(fixtures, 'expedition-ships.json');

function nav(multiplier: number, hours: number) {
  return withRaw(base, {
    expeditionresult: 'navigation',
    resourcesgained: undefined,
    navigation: JSON.stringify({
      returnTimeAbsoluteIncreaseHours: hours,
      returnTimeMultiplier: multiplier,
    }),
  });
}

describe('parseExpedition', () => {
  it.each(fixtures.map((f) => [f.file, f] as const))('%s matches expected', (_n, f) => {
    expect(parseExpedition(f.observation)).toEqual(f.expected);
  });

  it('rejects invalid resourcesgained JSON naming the attribute', () => {
    const r = parseExpedition(withRaw(base, { resourcesgained: '{nope' }));
    expect(r.status).toBe('unrecognized');
    if (r.status === 'unrecognized') expect(r.reason).toContain('resourcesgained');
  });

  it('rejects a missing timestamp with occurredAt null', () => {
    const r = parseExpedition(withRaw(base, { timestamp: undefined }));
    expect(r).toMatchObject({ status: 'unrecognized', occurredAt: null, externalKey: 'msg:5001' });
  });

  it('rejects an unknown expeditionresult', () => {
    expect(parseExpedition(withRaw(base, { expeditionresult: 'foo' })).status).toBe('unrecognized');
  });

  it('computes occurredAt as timestamp x 1000', () => {
    const r = parseExpedition(withRaw(base, { timestamp: '1234' }));
    expect(r).toMatchObject({ status: 'ok', occurredAt: 1_234_000 });
  });

  it('keeps no localized name: observations differing only by names give equal events', () => {
    const renamed = withRaw(ships, {
      technologiesgained:
        '{"202":{"name":"Kleiner Transporter","amount":5},"204":{"name":"Leichter Jaeger","amount":3}}',
    });
    expect(parseExpedition(renamed)).toEqual(parseExpedition(ships));
  });

  it('keeps no localized item name', () => {
    const item = observationOf(fixtures, 'expedition-item.json');
    const renamed = withRaw(item, {
      itemsgained:
        '[{"id":"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6","amount":1,"name":"Bronzener Detroid"}]',
    });
    expect(parseExpedition(renamed)).toEqual(parseExpedition(item));
  });

  it.each([
    [0.5, 0, 'early'],
    [1, 2, 'late'],
    [1.5, 0, 'late'],
  ])('navigation multiplier %s / +%sh is %s', (m, h, expected) => {
    const r = parseExpedition(nav(m, h));
    expect(r.status === 'ok' && r.event.kind === 'expedition' && r.event.result).toBe(expected);
  });

  it('rejects navigation that is neither early nor late', () => {
    expect(parseExpedition(nav(1, 0)).status).toBe('unrecognized');
  });

  it('treats a resource absent from resourcesgained as a known 0', () => {
    const r = parseExpedition(withRaw(base, { resourcesgained: '{"crystal":5}' }));
    expect(r.status === 'ok' && r.event.kind === 'expedition' && r.event.resources).toEqual({
      metal: 0,
      crystal: 5,
      deuterium: 0,
    });
  });

  it('leaves resources null when resourcesgained is missing', () => {
    const r = parseExpedition(withRaw(base, { resourcesgained: undefined }));
    expect(r.status === 'ok' && r.event.kind === 'expedition' && r.event.resources).toBeNull();
  });

  it('rejects out-of-range size and depletion', () => {
    expect(parseExpedition(withRaw(base, { size: '3' })).status).toBe('unrecognized');
    expect(parseExpedition(withRaw(base, { depletion: '9' })).status).toBe('unrecognized');
  });
});
