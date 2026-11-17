import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Config } from '../../src/config';

let lastIp = 0;

// A browser-like client for /api/site: keeps cookies and sends the CSRF token as a header.
export function siteClient(app: FastifyInstance) {
  const jar = new Map<string, string>();
  const ip = `10.50.${Math.floor(++lastIp / 250)}.${(lastIp % 250) + 1}`;
  let csrf = '';

  const store = (res: LightMyRequestResponse) => {
    for (const raw of [res.headers['set-cookie'] ?? []].flat()) {
      const [pair = ''] = String(raw).split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value) jar.set(name, value);
      else jar.delete(name);
    }
  };

  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');

  async function call(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    opts: { csrf?: boolean; headers?: Record<string, string> } = {},
  ) {
    const headers: Record<string, string> = { ...opts.headers };
    if (jar.size > 0) headers.cookie = cookie();
    if (opts.csrf !== false && csrf) headers['x-csrf-token'] = csrf;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.inject({
      method,
      url: `/api/site${path}`,
      remoteAddress: ip,
      headers,
      payload: body === undefined ? undefined : JSON.stringify(body),
    });
    store(res);
    return res;
  }

  async function session() {
    const res = await call('GET', '/session');
    csrf = res.json().csrfToken;
    return res.json();
  }

  async function login(username: string, password: string) {
    await session();
    const res = await call('POST', '/login', { username, password });
    if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
    await session();
    return res;
  }

  return { call, session, login, cookie, ip };
}

export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  databaseUrl: 'unused',
  sessionSecret: 'ab'.repeat(32),
  port: 3000,
  publicUrl: 'http://localhost:3000',
  trustProxy: ['loopback', 'linklocal', 'uniquelocal'],
  openSignup: false,
  ...overrides,
});
