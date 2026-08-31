/**
 * Motor de remuneração do entregador — configurável, transparente,
 * independente da taxa cobrada do cliente.
 *
 * A política fica em `payout_policies.config` (por restaurante, ou a global).
 * Nada de valor hardcoded na regra de negócio: o cálculo lê a config.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { PayoutConfig } from '../types';

type DB = SupabaseClient<Database>;

export const DEFAULT_PAYOUT_CONFIG: PayoutConfig = {
  base: 7.5,
  per_km: 0,
  free_km: 2,
  grouped_extra: 3,
  peak_bonus: 0,
  peak_hours: [[18, 21]],
  min_payout: 7.5,
};

export type PayoutInput = {
  distanceKm: number | null;
  /** quantos pedidos o motoboy leva nessa rota (1 = entrega simples) */
  groupSize?: number;
  /** instante da entrega (para bônus de pico); default = agora */
  at?: Date;
};

export type PayoutResult = {
  total: number;
  breakdown: { label: string; amount: number }[];
  config: PayoutConfig;
};

function isPeak(config: PayoutConfig, at: Date): boolean {
  const h = at.getHours();
  return (config.peak_hours ?? []).some(([start, end]) => h >= start && h < end);
}

/** Calcula a remuneração para uma entrega, dado uma política. */
export function computeDriverPayout(config: PayoutConfig, input: PayoutInput): PayoutResult {
  const c = { ...DEFAULT_PAYOUT_CONFIG, ...config };
  const at = input.at ?? new Date();
  const groupSize = Math.max(1, Math.round(input.groupSize ?? 1));
  const breakdown: { label: string; amount: number }[] = [];

  breakdown.push({ label: 'Valor base', amount: round(c.base) });

  if (c.per_km > 0 && input.distanceKm != null) {
    const billableKm = Math.max(0, input.distanceKm - c.free_km);
    if (billableKm > 0) {
      breakdown.push({
        label: `Distância (${billableKm.toFixed(1)} km × ${money(c.per_km)})`,
        amount: round(billableKm * c.per_km),
      });
    }
  }

  if (groupSize > 1 && c.grouped_extra > 0) {
    breakdown.push({
      label: `Agrupamento (+${groupSize - 1} pedido${groupSize - 1 === 1 ? '' : 's'})`,
      amount: round((groupSize - 1) * c.grouped_extra),
    });
  }

  if (c.peak_bonus > 0 && isPeak(c, at)) {
    breakdown.push({ label: 'Bônus de pico', amount: round(c.peak_bonus) });
  }

  let total = round(breakdown.reduce((s, b) => s + b.amount, 0));
  if (total < c.min_payout) {
    breakdown.push({ label: 'Ajuste ao mínimo', amount: round(c.min_payout - total) });
    total = round(c.min_payout);
  }

  return { total, breakdown, config: c };
}

/** Carrega a política de payout do restaurante (ou a global). */
export async function getPayoutPolicy(db: DB, restaurantId: string): Promise<PayoutConfig> {
  const { data: own } = await db
    .from('payout_policies')
    .select('config')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .maybeSingle();
  if (own?.config) return { ...DEFAULT_PAYOUT_CONFIG, ...(own.config as PayoutConfig) };

  const { data: global } = await db
    .from('payout_policies')
    .select('config')
    .is('restaurant_id', null)
    .eq('active', true)
    .maybeSingle();
  return { ...DEFAULT_PAYOUT_CONFIG, ...((global?.config as PayoutConfig) ?? {}) };
}

/**
 * Financeiro da logística de uma entrega:
 *  taxa cobrada do cliente/restaurante  (customer_fee)
 *  − remuneração do entregador          (driver_payout)
 *  = margem logística                   (logistics_margin)
 *
 * A taxa cobrada vem de: order.customer_fee → order.delivery_fee → logistics_config.customer_fee.
 */
export function computeLogisticsFinance(args: {
  customerFee: number;
  driverPayout: number;
}): { leevaFee: number; driverPayout: number; margin: number } {
  const leevaFee = round(Math.max(0, args.customerFee));
  const driverPayout = round(Math.max(0, args.driverPayout));
  return { leevaFee, driverPayout, margin: round(leevaFee - driverPayout) };
}

const round = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `R$ ${n.toFixed(2)}`;
