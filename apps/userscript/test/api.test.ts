import type { ObservationBatch } from '@app/shared';
import { describe, expect, it } from 'vitest';
import { memoryGm } from '../src/gm';
import type { ClientSettings } from '../src/storage';
import { createApi } from '../src/sync/api';

const settings = (patch: Partial<ClientSettings> = {}): ClientSettings => ({
  serverUrl: 'https://x.test',
  apiKey: 'secret-key',
  consent: true,
  hideOglightBox: false,
  deviceId: 'dev',
  ...patch,
});

const setup = (patch: Partial<ClientSettings> = {}) => {
  const gm = memoryGm();
  return { gm, api: createApi(gm, settings(patch), '1.2.3') };
};

const batch: ObservationBatch = { clientVersion: '1.2.3', deviceId: 'dev', observations: [] };

describe('createApi', () => {
  it('pings with joined URL and headers', async () => {
    const { gm, api } = setup({ serverUrl: 'https://x.test//' });
    gm.respondWith(() => ({
      status: 200,
      body: JSON.stringify({ ok: true, username: 'bob', apiVersion: 1 }),
    }));
    const res = await api.ping();
    expect(res).toEqual({
      ok: true,
      data: { ok: true, username: 'bob', apiVersion: 1 },
    });
    const req = gm.requests[0];
    expect(req?.url).toBe('https://x.test/api/v1/ping');
    expect(req?.method).toBe('GET');
    expect(req?.headers?.Authorization).toBe('Bearer secret-key');
    expect(req?.headers?.['X-Client-Version']).toBe('1.2.3');
    expect(req?.timeout).toBe(15_000);
  });

  it('joins a URL without trailing slash identically', async () => {
    const { gm, api } = setup();
    gm.respondWith(() => ({ status: 200, body: '{}' }));
    await api.ping();
    expect(gm.requests[0]?.url).toBe('https://x.test/api/v1/ping');
  });

  it.each([
    [401, 'invalid_key'],
    [426, 'client_outdated'],
    [429, 'rate_limited'],
    [413, 'payload_too_large'],
    [400, 'invalid_payload'],
    [404, 'not_found'],
    [500, 'server_error'],
    [502, 'server_error'],
    [302, 'server_error'],
  ])('maps status %i to %s', async (status, error) => {
    const { gm, api } = setup();
    gm.respondWith(() => ({ status, body: JSON.stringify({ error: 'x', message: 'y' }) }));
    expect(await api.ping()).toEqual({ ok: false, error });
  });

  it('maps a rejected request to unreachable', async () => {
    const { gm, api } = setup();
    gm.respondWith(() => Promise.reject(new Error('timeout')));
    expect(await api.ping()).toEqual({ ok: false, error: 'unreachable' });
  });

  it('maps unparseable 2xx JSON to server_error', async () => {
    const { gm, api } = setup();
    gm.respondWith(() => ({ status: 200, body: '<html>' }));
    expect(await api.ping()).toEqual({ ok: false, error: 'server_error' });
  });

  it.each([{ serverUrl: null }, { apiKey: null }, { serverUrl: '' }, { apiKey: '' }])(
    'returns not_configured without any request for %j',
    async (patch) => {
      const { gm, api } = setup(patch);
      expect(await api.ping()).toEqual({ ok: false, error: 'not_configured' });
      expect(await api.sendBatch(batch)).toEqual({ ok: false, error: 'not_configured' });
      expect(
        await api.getStats({
          serverId: 1,
          lang: 'en',
          playerId: 2,
          period: 'day',
          today: '2026-01-01',
        }),
      ).toEqual({ ok: false, error: 'not_configured' });
      expect(gm.requests).toHaveLength(0);
    },
  );

  it('posts a batch as JSON', async () => {
    const { gm, api } = setup();
    gm.respondWith(() => ({ status: 200, body: JSON.stringify({ results: [] }) }));
    expect(await api.sendBatch(batch)).toEqual({ ok: true, data: { results: [] } });
    const req = gm.requests[0];
    expect(req?.method).toBe('POST');
    expect(req?.url).toBe('https://x.test/api/v1/observations');
    expect(req?.headers?.['Content-Type']).toBe('application/json');
    expect(JSON.parse(req?.data ?? '')).toEqual(batch);
  });

  it('requests stats with an encoded query', async () => {
    const { gm, api } = setup();
    gm.respondWith(() => ({ status: 200, body: '{"period":"week"}' }));
    await api.getStats({
      serverId: 7,
      lang: 'en',
      playerId: 42,
      period: 'week',
      today: '2026-11-11',
    });
    expect(gm.requests[0]?.url).toBe(
      'https://x.test/api/v1/stats?serverId=7&lang=en&playerId=42&period=week&today=2026-11-11',
    );
    expect(gm.requests[0]?.method).toBe('GET');
  });

  it('url-encodes query values', async () => {
    const { gm, api } = setup();
    gm.respondWith(() => ({ status: 200, body: '{}' }));
    await api.getStats({ serverId: 1, lang: 'a&b', playerId: 2, period: 'day', today: 'x y' });
    expect(gm.requests[0]?.url).toContain('lang=a%26b');
    expect(gm.requests[0]?.url).toContain('today=x%20y');
  });
});
