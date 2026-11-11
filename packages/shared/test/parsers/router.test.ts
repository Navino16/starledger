import { describe, expect, it } from 'vitest';
import { PARSER_VERSION, parseMessage, TRACKED_MESSAGE_TYPES } from '../../src/parsers';
import { loadFixtures, observationOf, withRaw } from './helpers';

const fixtures = loadFixtures('');
const recycling = observationOf(fixtures, 'recycling.json');
const wreckfield = observationOf(fixtures, 'wreckfield.json');

const reasonOf = (r: ReturnType<typeof parseMessage>) =>
  r.status === 'unrecognized' ? r.reason : null;
const eventOf = (r: ReturnType<typeof parseMessage>) => (r.status === 'ok' ? r.event : null);

describe('parseMessage', () => {
  it('routes every fixture to the right parser', () => {
    expect(fixtures).toHaveLength(20);
    for (const f of fixtures) expect(parseMessage(f.observation), f.file).toEqual(f.expected);
  });

  it('exposes the parser version and tracked types', () => {
    expect(PARSER_VERSION).toBe(1);
    expect(TRACKED_MESSAGE_TYPES).toEqual([25, 32, 33, 34, 41, 48, 54, 61]);
  });

  it.each([33, 34, 99, null])('marks message type %s as unsupported', (messageType) => {
    const result = parseMessage({ ...recycling, messageType });
    expect(result.status).toBe('unrecognized');
    expect(reasonOf(result)).toContain('unsupported message type');
    expect(result.externalKey).toBe('msg:5018');
  });

  it('keeps occurredAt of an unsupported message when the timestamp is valid', () => {
    expect(parseMessage({ ...recycling, messageType: 33 })).toMatchObject({
      occurredAt: 1790001800000,
    });
  });

  it('keeps occurredAt null for an unsupported message without timestamp', () => {
    const obs = withRaw({ ...recycling, messageType: 99 }, { timestamp: undefined });
    expect(parseMessage(obs)).toMatchObject({ occurredAt: null });
  });

  it('does not treat Object prototype keys as message types', () => {
    expect(parseMessage({ ...recycling, messageType: 0 }).status).toBe('unrecognized');
  });
});

describe('recycling', () => {
  it('falls back to coords when targetcoordinates is absent', () => {
    const obs = withRaw(recycling, { targetcoordinates: undefined });
    expect(eventOf(parseMessage(obs))).toMatchObject({ coords: { position: 7 } });
  });

  it('treats an absent metal or deuterium as 0', () => {
    const obs = withRaw(recycling, { recycledresources: '{"crystal":600}' });
    expect(eventOf(parseMessage(obs))).toMatchObject({
      resources: { metal: 0, crystal: 600, deuterium: 0 },
    });
  });

  it('falls back to coords when targetcoordinates is empty', () => {
    const obs = withRaw(recycling, { targetcoordinates: '' });
    expect(eventOf(parseMessage(obs))).toMatchObject({ coords: { position: 7 } });
  });

  it('is unrecognized when the timestamp is out of Date range', () => {
    const obs = withRaw(recycling, { timestamp: '99999999999999999999' });
    expect(parseMessage(obs)).toMatchObject({ status: 'unrecognized', occurredAt: null });
  });

  it('treats an absent deuterium as 0', () => {
    expect(eventOf(parseMessage(recycling))).toMatchObject({
      resources: { metal: 1200, crystal: 800, deuterium: 0 },
    });
  });

  it('flags position 16 as expedition and others as not', () => {
    expect(eventOf(parseMessage(recycling))).toMatchObject({ isExpedition: false });
    const obs = withRaw(recycling, { targetcoordinates: '4:100:16' });
    expect(eventOf(parseMessage(obs))).toMatchObject({ isExpedition: true });
  });

  it.each([
    ['no coordinates', { targetcoordinates: undefined, coords: undefined }],
    ['invalid targetcoordinates', { targetcoordinates: 'nope' }],
    ['missing recycledresources', { recycledresources: undefined }],
    ['invalid recycledresources JSON', { recycledresources: '{' }],
    ['negative resources', { recycledresources: '{"metal":-1}' }],
  ])('is unrecognized with %s', (_n, patch) => {
    expect(parseMessage(withRaw(recycling, patch)).status).toBe('unrecognized');
  });

  it('is unrecognized without timestamp', () => {
    const r = parseMessage(withRaw(recycling, { timestamp: undefined }));
    expect(r).toMatchObject({ status: 'unrecognized', occurredAt: null });
  });
});

describe('wreckfield', () => {
  it('flattens technologiesrecovered amounts', () => {
    expect(eventOf(parseMessage(wreckfield))).toMatchObject({
      shipsRecovered: { '203': 2, '204': 4 },
    });
  });

  it.each([
    ['missing coordinates', { sourceplanetcoordinates: undefined }],
    ['invalid coordinates', { sourceplanetcoordinates: 'x' }],
    ['missing technologiesrecovered', { technologiesrecovered: undefined }],
    ['invalid JSON', { technologiesrecovered: '{' }],
    ['wrong shape', { technologiesrecovered: '{"203":2}' }],
  ])('is unrecognized with %s', (_n, patch) => {
    expect(parseMessage(withRaw(wreckfield, patch)).status).toBe('unrecognized');
  });
});
