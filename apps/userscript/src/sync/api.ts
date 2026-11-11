import type { ApiError, BatchAck, ObservationBatch, StatsPeriod, StatsResponse } from '@app/shared';
import type { Gm, GmResponse } from '../gm';
import type { ClientSettings } from '../storage';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type StatsQuery = {
  serverId: number;
  lang: string;
  playerId: number;
  period: StatsPeriod;
  today: string;
};

export type PingData = { ok: boolean; username: string; apiVersion: number };

const REQUEST_TIMEOUT_MS = 15_000;

const STATUS_ERRORS: Record<number, ApiError> = {
  400: 'invalid_payload',
  401: 'invalid_key',
  404: 'not_found',
  413: 'payload_too_large',
  426: 'client_outdated',
  429: 'rate_limited',
};

export function createApi(gm: Gm, settings: ClientSettings, clientVersion: string) {
  async function call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    const { serverUrl, apiKey } = settings;
    if (!serverUrl || !apiKey) return { ok: false, error: 'not_configured' };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'X-Client-Version': clientVersion,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res: GmResponse;
    try {
      // AGENTS.md §4: requests go only to the user's own server, never to the game
      res = await gm.request({
        method,
        url: `${serverUrl.replace(/\/+$/, '')}${path}`,
        headers,
        data: body === undefined ? undefined : JSON.stringify(body),
        timeout: REQUEST_TIMEOUT_MS,
      });
    } catch {
      return { ok: false, error: 'unreachable' };
    }

    if (res.status < 200 || res.status >= 300) {
      return { ok: false, error: STATUS_ERRORS[res.status] ?? 'server_error' };
    }
    try {
      return { ok: true, data: JSON.parse(res.body) as T };
    } catch {
      return { ok: false, error: 'server_error' };
    }
  }

  return {
    ping: () => call<PingData>('GET', '/api/v1/ping'),
    sendBatch: (batch: ObservationBatch) => call<BatchAck>('POST', '/api/v1/observations', batch),
    getStats: (q: StatsQuery) => {
      const query = Object.entries(q)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&');
      return call<StatsResponse>('GET', `/api/v1/stats?${query}`);
    },
  };
}
