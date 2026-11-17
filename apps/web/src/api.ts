import { SITE_ERROR_CODES, type SiteErrorCode } from '@app/shared';
import type { ZodType } from 'zod';

export type ApiErrorCode = SiteErrorCode | 'network';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
  ) {
    super(code);
  }
}

let csrfToken = '';
export const setCsrfToken = (token: string) => {
  csrfToken = token;
};

const isSiteErrorCode = (value: unknown): value is SiteErrorCode =>
  SITE_ERROR_CODES.includes(value as SiteErrorCode);

export async function apiFetch<T = undefined>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; schema?: ZodType<T> } = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['x-csrf-token'] = csrfToken;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/api/site${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const code = (body as { error?: unknown } | null)?.error;
    throw new ApiError(res.status, isSiteErrorCode(code) ? code : 'server_error');
  }
  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json();
  return init.schema ? init.schema.parse(json) : (json as T);
}
