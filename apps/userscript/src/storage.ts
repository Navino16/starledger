import type { Gm } from './gm';

export type ClientSettings = {
  serverUrl: string | null;
  apiKey: string | null;
  consent: boolean;
  hideOglightBox: boolean;
  deviceId: string;
};

const KEY = 'starledger.settings';

type Stored = Partial<ClientSettings>;

export function loadSettings(gm: Gm): ClientSettings {
  const stored = gm.get<Stored>(KEY, {});
  const settings: ClientSettings = {
    serverUrl: stored.serverUrl ?? null,
    apiKey: stored.apiKey ?? null,
    consent: stored.consent ?? false,
    hideOglightBox: stored.hideOglightBox ?? false,
    deviceId: stored.deviceId ?? crypto.randomUUID(),
  };
  if (!stored.deviceId) gm.set(KEY, settings);
  return settings;
}

export function saveSettings(
  gm: Gm,
  patch: Partial<Omit<ClientSettings, 'deviceId'>>,
): ClientSettings {
  const next = { ...loadSettings(gm), ...patch };
  gm.set(KEY, next);
  return next;
}
