import { describe, expect, it } from 'vitest';
import { parseLifeformDiscovery } from '../../src/parsers/lifeform';
import { loadFixtures, observationOf, withRaw } from './helpers';

const fixtures = loadFixtures('discovery-');
const base = observationOf(fixtures, 'discovery-xp.json');

function result(patch: Record<string, string | undefined>) {
  const r = parseLifeformDiscovery(withRaw(base, patch));
  return r.status === 'ok' && r.event.kind === 'lifeform_discovery' ? r.event.result : r;
}

describe('parseLifeformDiscovery', () => {
  it.each(fixtures.map((f) => [f.file, f] as const))('%s matches expected', (_n, f) => {
    expect(parseLifeformDiscovery(f.observation)).toEqual(f.expected);
  });

  it('rejects a missing timestamp with occurredAt null', () => {
    expect(parseLifeformDiscovery(withRaw(base, { timestamp: undefined }))).toMatchObject({
      status: 'unrecognized',
      occurredAt: null,
    });
  });

  it('infers the type when discoverytype is absent', () => {
    expect(result({ artifactsfound: '3', lifeformgainedexperience: '10' })).toBe('artifacts');
    expect(result({})).toBe('lifeform_xp');
    expect(result({ lifeformgainedexperience: undefined })).toBe('none');
  });

  it('maps explicit discovery types', () => {
    expect(result({ discoverytype: 'lifeform-found' })).toBe('lifeform_found');
    expect(result({ discoverytype: 'ship-lost', shipslost: '{"203":1}' })).toBe('ship_lost');
    expect(result({ discoverytype: 'none' })).toBe('none');
  });

  it('rejects an unknown discoverytype', () => {
    expect(parseLifeformDiscovery(withRaw(base, { discoverytype: 'foo' })).status).toBe(
      'unrecognized',
    );
  });

  it('keeps an unknown artifactssize and maps an empty one to null', () => {
    const size = (v: string) => {
      const r = parseLifeformDiscovery(withRaw(base, { artifactssize: v }));
      return r.status === 'ok' && r.event.kind === 'lifeform_discovery' && r.event.artifactsSize;
    };
    expect(size('mega')).toBe('mega');
    expect(size('')).toBeNull();
  });

  it('rejects invalid shipslost JSON naming the attribute', () => {
    const r = parseLifeformDiscovery(withRaw(base, { shipslost: 'x' }));
    expect(r).toMatchObject({ status: 'unrecognized' });
    if (r.status === 'unrecognized') expect(r.reason).toContain('shipslost');
  });
});
