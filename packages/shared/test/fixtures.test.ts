import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { observationSchema } from '../src/observation';
import { parseMessage } from '../src/parsers';

const dir = join(import.meta.dirname, 'fixtures/messages');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('synthetic message fixtures', () => {
  it('contains the 20 expected fixtures', () => {
    expect(files).toHaveLength(20);
  });

  it.each(files)('%s is a synthetic, valid message observation', (file) => {
    const fixture = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    expect(fixture.synthetic).toBe(true);
    const obs = observationSchema.parse(fixture.observation);
    expect(obs.kind).toBe('message');
    expect(fixture.expected.status).toBe('ok');
  });
});

const realDir = join(import.meta.dirname, 'fixtures/messages-real');
const realFiles = readdirSync(realDir).filter((f) => f.endsWith('.json'));

describe('real PTS message fixtures', () => {
  it('contains the 6 expected fixtures', () => {
    expect(realFiles).toHaveLength(6);
  });

  it.each(realFiles)('%s is a real, valid observation parsed as expected', (file) => {
    const fixture = JSON.parse(readFileSync(join(realDir, file), 'utf8'));
    expect(fixture.synthetic).toBe(false);
    const obs = observationSchema.parse(fixture.observation);
    expect(obs.kind).toBe('message');
    if (obs.kind !== 'message') return;
    expect(parseMessage(obs)).toEqual(fixture.expected);
  });
});
