import { z } from 'zod';

const booleanString = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((v) => v === 'true');

// Fastify trustProxy forms: boolean, hop count, or list of trusted IPs/CIDRs.
const trustProxyValue = z
  .string()
  .default('1')
  .transform((raw, ctx): boolean | number | string[] => {
    const v = raw.trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^\d+$/.test(v)) return Number(v);
    const list = v.split(',').map((entry) => entry.trim());
    if (v === '' || list.some((entry) => entry === '')) {
      ctx.addIssue({ code: 'custom', message: 'true, false, a hop count or a list of IPs/CIDRs' });
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
