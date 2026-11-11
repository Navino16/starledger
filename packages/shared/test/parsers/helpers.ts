import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type MessageObservation, messageObservationSchema } from '../../src/observation';

const dir = join(import.meta.dirname, '../fixtures/messages');

export function loadFixtures(prefix: string) {
  return readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .map((file) => {
      const fixture = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      return {
        file,
        observation: messageObservationSchema.parse(fixture.observation),
        expected: fixture.expected,
      };
    });
}

export function withRaw(
  obs: MessageObservation,
  patch: Record<string, string | undefined>,
): MessageObservation {
  const raw: Record<string, string> = { ...obs.raw };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete raw[k];
    else raw[k] = v;
  }
  return { ...obs, raw };
}

export function observationOf(fixtures: ReturnType<typeof loadFixtures>, file: string) {
  const found = fixtures.find((f) => f.file === file);
  if (!found) throw new Error(`missing fixture ${file}`);
  return found.observation;
}
