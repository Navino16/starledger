import { z } from 'zod';

// Contracts of the session-authenticated site API under /api/site (spec web-front, "Architecture").

export const SITE_LOCALES = ['fr', 'en'] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

export const SITE_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'csrf_invalid',
  'not_found',
  'rate_limited',
  'invalid_payload',
  'server_error',
  'invalid_credentials',
  'invitation_invalid',
  'reset_invalid',
  'username_invalid',
  'password_short',
  'username_taken',
  'name_invalid',
  'current_invalid',
  'settings_invalid',
  'unknown_user',
] as const;
export type SiteErrorCode = (typeof SITE_ERROR_CODES)[number];
export const siteErrorSchema = z.object({ error: z.string() });

const MAX_PASSWORD_LENGTH = 1024;
const MAX_USERNAME_INPUT = 256;
const password = z.string().max(MAX_PASSWORD_LENGTH);
const username = z.string().max(MAX_USERNAME_INPUT);

export const siteUserSchema = z.object({
  username: z.string(),
  isAdmin: z.boolean(),
  locale: z.enum(SITE_LOCALES),
});
export type SiteUser = z.infer<typeof siteUserSchema>;

export const sessionResponseSchema = z.object({
  user: siteUserSchema.nullable(),
  locale: z.enum(SITE_LOCALES),
  csrfToken: z.string(),
  openSignup: z.boolean(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const loginRequestSchema = z.object({ username, password });
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export const signupRequestSchema = loginRequestSchema;
export type SignupRequest = LoginRequest;
export const userResponseSchema = z.object({ user: siteUserSchema });

export const resetInfoResponseSchema = z.object({ username: z.string() });
export const resetRequestSchema = z.object({ password });
export type ResetRequest = z.infer<typeof resetRequestSchema>;

export const apiKeySummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
export type ApiKeySummaryDto = z.infer<typeof apiKeySummarySchema>;
export const apiKeysResponseSchema = z.object({ keys: z.array(apiKeySummarySchema) });
export const MAX_KEY_NAME_LENGTH = 64;
export const createKeyRequestSchema = z.object({ name: z.string().max(MAX_PASSWORD_LENGTH) });
export const createKeyResponseSchema = z.object({ id: z.string(), key: z.string() });

export const changePasswordRequestSchema = z.object({ current: password, next: password });
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const MIN_MSU_RATIO = 0.01;
export const MAX_MSU_RATIO = 100;
const msu = z.number().min(MIN_MSU_RATIO).lte(MAX_MSU_RATIO);
const percent = z.number().int().min(0).max(100);
export const valuationSettingsSchema = z.strictObject({
  msuRatio: z.tuple([msu, msu, msu]),
  expeditionShipRatio: percent,
  anomalyShipRatio: percent,
  ignoreExpeShipsLoss: z.boolean(),
  ignoreConsumption: z.boolean(),
  includeTradesInBalance: z.boolean(),
});
export const universeSettingsSchema = z.object({
  serverId: z.number(),
  lang: z.string(),
  settings: valuationSettingsSchema,
});
export type UniverseSettings = z.infer<typeof universeSettingsSchema>;
export const settingsResponseSchema = z.object({ universes: z.array(universeSettingsSchema) });
export const savedSettingsResponseSchema = z.object({ settings: valuationSettingsSchema });

export const createResetRequestSchema = z.object({ username });
export const linkResponseSchema = z.object({ url: z.string() });
export const resetLinkResponseSchema = z.object({ url: z.string(), username: z.string() });
