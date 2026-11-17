import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, setCsrfToken } from '../src/api';
import { describeError, formatDate, formatNumber, translate } from '../src/i18n';
import { callsTo, mockApi } from './helpers';

describe('apiFetch', () => {
  it('sends JSON with the CSRF token on writes, not on reads', async () => {
    setCsrfToken('tok');
    const fetch = mockApi({ 'POST /login': [200, { ok: true }], 'GET /api-keys': [200, {}] });
    await apiFetch('/login', { method: 'POST', body: { a: 1 } });
    await apiFetch('/api-keys');
    const [, write] = callsTo(fetch, 'POST /login')[0] ?? [];
    expect(write?.headers).toEqual({ 'x-csrf-token': 'tok', 'content-type': 'application/json' });
    expect(write?.body).toBe('{"a":1}');
    expect(write?.credentials).toBe('same-origin');
    const [, read] = callsTo(fetch, 'GET /api-keys')[0] ?? [];
    expect(read?.headers).toEqual({});
  });

  it('turns an error body into an ApiError with its code', async () => {
    mockApi({ 'POST /logout': [403, { error: 'csrf_invalid' }] });
    const error = await apiFetch('/logout', { method: 'POST' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'csrf_invalid' });
  });

  it('reads an unknown or missing error code as server_error', async () => {
    mockApi({ 'GET /a': [502, { error: 'weird' }], 'GET /b': [500] });
    await expect(apiFetch('/a')).rejects.toMatchObject({ code: 'server_error', status: 502 });
    await expect(apiFetch('/b')).rejects.toMatchObject({ code: 'server_error', status: 500 });
  });

  it('returns undefined for 204 and reports network failures', async () => {
    mockApi({ 'DELETE /api-keys/1': [204] });
    await expect(apiFetch('/api-keys/1', { method: 'DELETE' })).resolves.toBeUndefined();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(apiFetch('/session')).rejects.toMatchObject({ code: 'network', status: 0 });
  });
});

describe('i18n', () => {
  it('fills parameters and falls back to the key', () => {
    expect(translate('fr', 'reset.account', { username: 'vega' })).toBe('Compte : vega');
    expect(translate('en', 'signup.passwordHint', { min: 12 })).toBe('At least 12 characters');
    expect(translate('fr', 'nope.missing')).toBe('nope.missing');
  });

  it('formats dates and numbers the way the guide asks', () => {
    const date = '2026-11-16T14:32:00Z';
    expect(formatDate(date, 'fr', { time: true, timeZone: 'UTC' })).toBe('16 nov. 2026, 14:32');
    expect(formatDate(date, 'fr', { timeZone: 'UTC' })).toBe('16 nov. 2026');
    expect(formatDate(date, 'en', { time: true, timeZone: 'UTC' })).toBe('16 Nov 2026, 14:32');
    expect(formatNumber(2.5, 'fr')).toBe('2,5');
    expect(formatNumber(2.5, 'en')).toBe('2.5');
  });

  it('describes generic errors', () => {
    const t = (key: string) => translate('en', key);
    expect(describeError(t, new ApiError(0, 'network'))).toMatch(/cannot be reached/);
    expect(describeError(t, new ApiError(429, 'rate_limited'))).toMatch(/Too many attempts/);
    expect(describeError(t, new ApiError(403, 'csrf_invalid'))).toMatch(/Reload the page/);
    expect(describeError(t, new Error('boom'))).toMatch(/Something went wrong/);
  });
});
