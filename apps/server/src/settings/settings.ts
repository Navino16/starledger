import { DEFAULT_VALUATION, type ValuationSettings } from '@app/shared';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../db/schema';

export const MAX_MSU_RATIO = 100;

export async function getValuationSettings(
  db: Kysely<Database>,
  userId: string,
  serverId: number,
  lang: string,
): Promise<ValuationSettings> {
  const row = await db
    .selectFrom('universe_settings')
    .selectAll()
    .where('user_id', '=', userId)
    .where('server_id', '=', serverId)
    .where('lang', '=', lang)
    .executeTakeFirst();
  if (!row) return { ...DEFAULT_VALUATION, msuRatio: [...DEFAULT_VALUATION.msuRatio] };
  return {
    msuRatio: [Number(row.msu_metal), Number(row.msu_crystal), Number(row.msu_deuterium)],
    expeditionShipRatio: row.expedition_ship_ratio,
    ignoreExpeShipsLoss: row.ignore_expe_ships_loss,
    ignoreConsumption: row.ignore_consumption,
    includeTradesInBalance: row.include_trades_in_balance,
  };
}

export async function saveValuationSettings(
  db: Kysely<Database>,
  userId: string,
  serverId: number,
  lang: string,
  s: ValuationSettings,
): Promise<void> {
  const values = {
    msu_metal: s.msuRatio[0],
    msu_crystal: s.msuRatio[1],
    msu_deuterium: s.msuRatio[2],
    expedition_ship_ratio: s.expeditionShipRatio,
    ignore_expe_ships_loss: s.ignoreExpeShipsLoss,
    ignore_consumption: s.ignoreConsumption,
    include_trades_in_balance: s.includeTradesInBalance,
  };
  await db
    .insertInto('universe_settings')
    .values({ user_id: userId, server_id: serverId, lang, ...values })
    .onConflict((oc) => oc.columns(['user_id', 'server_id', 'lang']).doUpdateSet(values))
    .execute();
}

const numberField = z.string().trim().min(1).transform(Number).pipe(z.number().finite());
const ratio = numberField.pipe(z.number().gt(0).lte(MAX_MSU_RATIO));
const checkbox = z
  .string()
  .optional()
  .transform((v) => v !== undefined);

const formSchema = z
  .object({
    msuMetal: ratio,
    msuCrystal: ratio,
    msuDeuterium: ratio,
    expeditionShipRatio: numberField.pipe(z.number().int().min(0).max(100)),
    ignoreExpeShipsLoss: checkbox,
    ignoreConsumption: checkbox,
    includeTradesInBalance: checkbox,
  })
  .transform(
    ({ msuMetal, msuCrystal, msuDeuterium, ...rest }): ValuationSettings => ({
      msuRatio: [msuMetal, msuCrystal, msuDeuterium],
      ...rest,
    }),
  );

export function parseValuationForm(body: unknown): ValuationSettings | null {
  const parsed = formSchema.safeParse(body ?? {});
  return parsed.success ? parsed.data : null;
}
