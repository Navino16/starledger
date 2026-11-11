import { z } from 'zod';

const booleanString = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((v) => v === 'true');

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().regex(/^[0-9a-fA-F]{64}$/, '64 hexadecimal characters required'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_URL: z.url(),
  TRUST_PROXY: booleanString(true),
  OPEN_SIGNUP: booleanString(false),
});

export interface Config {
  databaseUrl: string;
  sessionSecret: string;
  port: number;
  publicUrl: string;
  trustProxy: boolean;
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
