import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { observationSchema } from '../src/observation';

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
