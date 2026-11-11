import { z } from 'zod';

export const resourcesSchema = z.object({
  metal: z.number(),
  crystal: z.number(),
  deuterium: z.number(),
});
export type Resources = z.infer<typeof resourcesSchema>;

export const shipCountsSchema = z.record(z.string(), z.number().int().nonnegative());
export type ShipCounts = z.infer<typeof shipCountsSchema>;

export const coordsSchema = z.object({
  galaxy: z.number().int(),
  system: z.number().int(),
  position: z.number().int(),
});
export type Coords = z.infer<typeof coordsSchema>;

export const MAX_SERVER_ID = 2_147_483_647;
export const LANG_PATTERN = /^[a-z]{2,3}$/;

export const accountRefSchema = z.object({
  serverId: z.number().int().min(1).max(MAX_SERVER_ID),
  lang: z.string().regex(LANG_PATTERN),
  playerId: z.number().int().nonnegative(),
  playerName: z.string().nullable(),
});
export type AccountRef = z.infer<typeof accountRefSchema>;
