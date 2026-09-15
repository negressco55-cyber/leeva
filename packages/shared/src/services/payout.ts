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
import { haversineKm, minutesForKm, isValidLatLng, type LatLng } from './geo';
import { getRoutingService } from './routing';

type DB = SupabaseClient<Database>;

export const DEFAULT_PAYOUT_CONFIG: PayoutConfig = {
  per_km: 2.0,
  per_km_grouped: 2.5,
  min_payout: 5,
  peak_bonus: 0,
  peak_hours: [[18, 21]],
  group_radius_km: 1,
  group_max_stops: 3,
};

/** Margem default do Leeva por entrega quando o restaurante não tem plano. */
export const DEFAULT_PLAN_MARGIN = 1.0;

export type PayoutInput = {
  distanceKm: number | null;
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

/**
 * Calcula a remuneração de uma entrega solta (ou da 1ª parada/líder de uma
 * rota agrupada — mesma fórmula, distância do restaurante até ela):
 *   max(distanceKm × per_km, min_payout) + peak_bonus (se pico)
 */
export function computeDriverPayout(config: PayoutConfig, input: PayoutInput): PayoutResult {
  const c = { ...DEFAULT_PAYOUT_CONFIG, ...config };
  const at = input.at ?? new Date();
  const distanceKm = Math.max(0, input.distanceKm ?? 0);
  const breakdown: { label: string; amount: number }[] = [];

  const byDistance = round(distanceKm * c.per_km);
  breakdown.push({ label: `Distância (${distanceKm.toFixed(1)} km × ${money(c.per_km)})`, amount: byDistance });

  let total = byDistance;
  if (total < c.min_payout) {
    breakdown.push({ label: 'Ajuste ao mínimo', amount: round(c.min_payout - total) });
    total = round(c.min_payout);
  }

  if (c.peak_bonus > 0 && isPeak(c, at)) {
    breakdown.push({ label: 'Bônus de pico', amount: round(c.peak_bonus) });
    total = round(total + c.peak_bonus);
  }

  return { total, breakdown, config: c };
}

/**
 * Remuneração de uma parada ADICIONAL (não-líder) de rota agrupada, sobre o
 * trecho incremental (da parada anterior até esta):
 *   max(legKm × per_km_grouped, min_payout)
 * Taxa por km mais alta que a entrega solta — compensa o motoboy por aceitar
 * agrupar — mas o mesmo piso mínimo.
 */
export function computeGroupedStopPayout(config: PayoutConfig, legKm: number): number {
  const c = { ...DEFAULT_PAYOUT_CONFIG, ...config };
  const km = Math.max(0, legKm);
  return round(Math.max(km * c.per_km_grouped, c.min_payout));
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

// ===========================================================================
// FASE 4 — cálculo automático da taxa de entrega (fonte única)
// ===========================================================================

/** Margem do Leeva por entrega, do plano do restaurante. */
export async function getPlanMargin(db: DB, restaurantId: string): Promise<number> {
  const { data } = await db
    .from('subscriptions')
    .select('plans(per_delivery_margin)')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  const m = (data as { plans?: { per_delivery_margin?: number | string } } | null)?.plans?.per_delivery_margin;
  return m != null ? Number(m) : DEFAULT_PLAN_MARGIN;
}

export type DeliveryCharge = {
  distanceKm: number | null;
  durationMin: number | null;
  driverPayout: number; // 100% para o motoboy
  margin: number; // margem do Leeva (do plano)
  total: number; // descontado do crédito do restaurante = driverPayout + margin
  breakdown: { label: string; amount: number }[];
};

/**
 * Calcula a taxa da entrega SEM gravar — para pré-visualização no formulário
 * de nova entrega. Mesma fórmula do `finalizeDeliveryCharge`.
 */
export async function computeDeliveryCharge(
  db: DB,
  restaurantId: string,
  dropoff: { latitude: number; longitude: number } | null,
): Promise<DeliveryCharge> {
  const { data: rst } = await db
    .from('restaurants')
    .select('latitude, longitude')
    .eq('id', restaurantId)
    .maybeSingle();

  const pickup: LatLng | null = isValidLatLng(rst?.latitude, rst?.longitude)
    ? { latitude: rst!.latitude as number, longitude: rst!.longitude as number }
    : null;
  const drop: LatLng | null =
    dropoff && isValidLatLng(dropoff.latitude, dropoff.longitude)
      ? { latitude: dropoff.latitude, longitude: dropoff.longitude }
      : null;

  let distanceKm: number | null = null;
  let durationMin: number | null = null;
  if (pickup && drop) {
    const leg = await getRoutingService().leg(pickup, drop);
    distanceKm = leg?.distanceKm ?? (haversineKm(pickup, drop) ?? null);
    if (!leg && distanceKm != null) distanceKm = round(distanceKm * 1.3);
    durationMin = leg?.durationMin ?? (distanceKm != null ? minutesForKm(distanceKm) : null);
  }

  const policy = await getPayoutPolicy(db, restaurantId);
  const payout = computeDriverPayout(policy, { distanceKm });
  const margin = round(await getPlanMargin(db, restaurantId));
  const total = round(payout.total + margin);

  return {
    distanceKm: distanceKm != null ? round(distanceKm) : null,
    durationMin: durationMin != null ? Math.round(durationMin) : null,
    driverPayout: payout.total,
    margin,
    total,
    breakdown: [...payout.breakdown, { label: 'Margem Leeva (plano)', amount: margin }],
  };
}

/**
 * Calcula a taxa da entrega UMA VEZ (na criação do pedido) e grava no pedido.
 *
 *   valor do motoboy = max(distância × per_km, min_payout)
 *   distância        = linha reta × 1,3 (fator de rua) — via RoutingService
 *   total cobrado    = valor do motoboy + margem do plano
 *
 * Se o pedido já pertence a uma rota agrupada (group_id), o valor por parada
 * já foi calculado e gravado por `grouping-dispatch.ts` (applyGroupPlan) —
 * esta função nunca recalcula um pedido agrupado, só entregas soltas.
 *
 * Depois disso, a oferta, a tela do restaurante e o pagamento leem SEMPRE
 * `orders.driver_payout` / `orders.customer_fee` — nada é recalculado.
 * Idempotente: se `driver_payout` já está setado, não faz nada.
 */
export async function finalizeDeliveryCharge(
  db: DB,
  orderId: string,
  restaurantId: string,
): Promise<DeliveryCharge | null> {
  const { data: order } = await db
    .from('orders')
    .select('id, latitude, longitude, driver_payout')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.driver_payout != null) return null;

  const charge = await computeDeliveryCharge(
    db,
    restaurantId,
    order.latitude != null && order.longitude != null
      ? { latitude: Number(order.latitude), longitude: Number(order.longitude) }
      : null,
  );

  await db
    .from('orders')
    .update({
      route_distance_km: charge.distanceKm,
      route_duration_min: charge.durationMin,
      driver_payout: charge.driverPayout,
      // customer_fee / leeva_fee = TOTAL cobrado do restaurante.
      // logistics_margin (coluna gerada) = leeva_fee − driver_payout = margem do Leeva.
      customer_fee: charge.total,
      leeva_fee: charge.total,
    })
    .eq('id', orderId);

  return charge;
}
