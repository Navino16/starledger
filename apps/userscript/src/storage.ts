import type { Gm } from './gm';

export type ClientSettings = {
  serverUrl: string | null;
  apiKey: string | null;
  consent: boolean;
  hideOglightBox: boolean;
  deviceId: string;
};

const KEY = 'starledger.settings';

// Bump when the consent wording changes: older stored consent counts as none.
export const CONSENT_VERSION = 1;

type Stored = Partial<ClientSettings> & { consentVersion?: number };

function persist(gm: Gm, settings: ClientSettings): void {
  gm.set(KEY, { ...settings, consentVersion: settings.consent ? CONSENT_VERSION : 0 });
}

export function loadSettings(gm: Gm): ClientSettings {
  const raw = gm.get<unknown>(KEY, {});
  const stored: Stored = typeof raw === 'object' && raw ? raw : {};
  const settings: ClientSettings = {
    serverUrl: stored.serverUrl ?? null,
    apiKey: stored.apiKey ?? null,
    consent: stored.consent === true && (stored.consentVersion ?? 0) >= CONSENT_VERSION,
    hideOglightBox: stored.hideOglightBox ?? false,
    deviceId: stored.deviceId ?? crypto.randomUUID(),
  };
  if (!stored.deviceId) persist(gm, settings);
  return settings;
}

export function saveSettings(
  gm: Gm,
  patch: Partial<Omit<ClientSettings, 'deviceId'>>,
): ClientSettings {
  const next = { ...loadSettings(gm), ...patch };
  persist(gm, next);
  return next;
}
