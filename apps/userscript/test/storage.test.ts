import { MIN_CLIENT_VERSION, parseSemver } from '@app/shared';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { memoryGm } from '../src/gm';
import { isAllowedUniverse } from '../src/pts-guard';
import { loadSettings, saveSettings } from '../src/storage';
import { CLIENT_VERSION } from '../src/version';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('loadSettings', () => {
  it('generates a stable UUID deviceId', () => {
    const gm = memoryGm();
    const first = loadSettings(gm);
    expect(first.deviceId).toMatch(UUID);
    expect(loadSettings(gm).deviceId).toBe(first.deviceId);
  });

  it('applies defaults', () => {
    expect(loadSettings(memoryGm())).toMatchObject({
      serverUrl: null,
      apiKey: null,
      consent: false,
      hideOglightBox: false,
    });
  });

  it('keeps deviceId across saveSettings', () => {
    const gm = memoryGm();
    const { deviceId } = loadSettings(gm);
    const saved = saveSettings(gm, { consent: true, serverUrl: 'https://x.test' });
    expect(saved).toMatchObject({ consent: true, serverUrl: 'https://x.test', deviceId });
    expect(loadSettings(gm)).toEqual(saved);
  });
});

describe('memoryGm', () => {
  it('records requests and returns stubbed responses', async () => {
    const gm = memoryGm();
    gm.respondWith(() => ({ status: 401, body: 'no' }));
    const res = await gm.request({ method: 'GET', url: 'https://x.test/a' });
    expect(res).toEqual({ status: 401, body: 'no' });
    expect(gm.requests).toEqual([{ method: 'GET', url: 'https://x.test/a' }]);
  });

  it('can simulate failures', async () => {
    const gm = memoryGm();
    gm.respondWith(() => Promise.reject(new Error('network error')));
    await expect(gm.request({ method: 'GET', url: 'u' })).rejects.toThrow('network error');
  });
});

describe('isAllowedUniverse', () => {
  const docWith = (content?: string) => {
    const doc = document.implementation.createHTMLDocument('');
    if (content !== undefined) {
      const meta = doc.createElement('meta');
      meta.name = 'ogame-universe';
      meta.content = content;
      doc.head.append(meta);
    }
    return doc;
  };

  it('allows the PTS universe', () => {
    expect(isAllowedUniverse(docWith('s808-en.ogame.gameforge.com'))).toBe(true);
  });

  it.each([['s1-fr.ogame.gameforge.com'], [''], [undefined]])('rejects %s', (c) => {
    expect(isAllowedUniverse(docWith(c))).toBe(false);
  });
});

describe('client version', () => {
  it('is the package version and is accepted by the server', () => {
    expect(CLIENT_VERSION).toBe(pkg.version);
    const v = parseSemver(CLIENT_VERSION);
    const min = parseSemver(MIN_CLIENT_VERSION);
    expect(v).not.toBeNull();
    if (!v || !min) throw new Error('unreachable');
    const cmp = v[0] - min[0] || v[1] - min[1] || v[2] - min[2];
    expect(cmp).toBeGreaterThanOrEqual(0);
  });
});
