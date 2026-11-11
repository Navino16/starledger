import { isIP } from 'node:net';
import { z } from 'zod';

const booleanString = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((v) => v === 'true');

const NAMED_RANGES = new Set(['loopback', 'linklocal', 'uniquelocal']);

function isTrustedEntry(entry: string): boolean {
  if (NAMED_RANGES.has(entry)) return true;
  const [address, prefix, ...rest] = entry.split('/');
  const family = isIP(address ?? '');
  if (family === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  return /^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128);
}

// Fastify trustProxy forms: boolean, hop count, or list of IPs/CIDRs/named ranges (PLAN scope 6).
const trustProxyValue = z
  .string()
  .default('loopback,linklocal,uniquelocal')
  .transform((raw, ctx): boolean | number | string[] => {
    const v = raw.trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^\d+$/.test(v)) return Number(v);
    const list = v.split(',').map((entry) => entry.trim());
    if (!list.every(isTrustedEntry)) {
      ctx.addIssue({
        code: 'custom',
        message:
          'true, false, a hop count, or a comma-separated list of IPs, CIDRs, loopback, linklocal, uniquelocal',
      });
      return z.NEVER;
    }
    return list;
  });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().regex(/^[0-9a-fA-F]{64}$/, '64 hexadecimal characters required'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_URL: z.url(),
  TRUST_PROXY: trustProxyValue,
  OPEN_SIGNUP: booleanString(false),
});

export interface Config {
  databaseUrl: string;
  sessionSecret: string;
  port: number;
  publicUrl: string;
  trustProxy: boolean | number | string[];
  openSignup: boolean;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = envSchema.parse(env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    sessionSecret: parsed.SESSION_SECRET,
    port: parsed.PORT,
    publicUrl: parsed.PUBLIC_URL,
    trustProxy: parsed.TRUST_PROXY,
    openSignup: parsed.OPEN_SIGNUP,
  };
}
