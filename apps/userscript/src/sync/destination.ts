import type { Gm } from '../gm';
import { loadSettings, saveSettings } from '../storage';
import type { createQueue } from './queue';

//! AGENTS.md §1.9: a new destination never inherits the old key or data collected for the old server
export function setDestination(
  gm: Gm,
  queue: ReturnType<typeof createQueue>,
  serverUrl: string,
  typedKey: string | null,
): boolean {
  const changed = serverUrl !== loadSettings(gm).serverUrl;
  if (changed) {
    saveSettings(gm, { serverUrl, apiKey: typedKey });
    queue.clear();
  }
  return changed;
}
