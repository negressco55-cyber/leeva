/**
 * ETAService — estimativa de chegada ao cliente.
 *
 * Usa os dados disponíveis (localização atual do motoboy, destino, rota
 * estimada, etapa atual). Devolve SEMPRE um intervalo, nunca horário exato,
 * porque os dados não permitem precisão. Estrutura pronta para melhorar
 * depois com histórico (campo `historicalAdjustmentMin`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { haversineKm, minutesForKm, isValidLatLng, type LatLng } from './geo';
import { getRoutingService } from './routing';

/** Acima disso a estimativa não é confiável (dados ruins de GPS, etc). */
const MAX_SANE_ETA_MIN = 180;

type DB = SupabaseClient<Database>;

export type EtaEstimate = {
  minMinutes: number;
  maxMinutes: number;
  basis: string; // o que foi usado para calcular
  isEstimate: boolean;
  computedAt: string;
};

/** Margem relativa do intervalo por etapa (quanto mais cedo, mais incerto). */
const SPREAD_BY_STATUS: Partial<Record<Database['public']['Enums']['order_status'], number>> = {
  waiting_dispatch: 0.6,
  preparing: 0.5,
  ready: 0.45,
  assigned: 0.4,
  picked_up: 0.3,
  in_route: 0.2,
};

export async function estimateOrderEta(db: DB, orderId: string): Promise<EtaEstimate | null> {
  const { data: order } = await db
    .from('orders')
    .select('id, restaurant_id, status, latitude, longitude, motoboy_id, ready_at, created_at')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;
  if (order.status === 'delivered' || order.status === 'cancelled') return null;

  const dropoff: LatLng | null = isValidLatLng(order.latitude, order.longitude)
    ? { latitude: order.latitude as number, longitude: order.longitude as number }
    : null;

  const { data: restaurant } = await db
    .from('restaurants')
    .select('latitude, longitude')
    .eq('id', order.restaurant_id)
    .maybeSingle();
  const pickup: LatLng | null = isValidLatLng(restaurant?.latitude, restaurant?.longitude)
    ? { latitude: restaurant!.latitude as number, longitude: restaurant!.longitude as number }
    : null;

  let driverPos: LatLng | null = null;
  if (order.motoboy_id) {
    const { data: m } = await db
      .from('motoboys')
      .select('current_latitude, current_longitude, location_updated_at')
      .eq('id', order.motoboy_id)
      .maybeSingle();
    // só usa a posição do motoboy se for recente (< 10 min) e válida
    const fresh =
      m?.location_updated_at != null &&
      Date.now() - new Date(m.location_updated_at).getTime() < 10 * 60_000;
    if (fresh && isValidLatLng(m?.current_latitude, m?.current_longitude))
      driverPos = { latitude: m!.current_latitude as number, longitude: m!.current_longitude as number };
  }

  const routing = getRoutingService();
  let travelMin: number | null = null;
  let basis: string;
  let isEstimate = true;

  if (['picked_up', 'in_route'].includes(order.status) && driverPos && dropoff) {
    const leg = await routing.leg(driverPos, dropoff);
    travelMin = leg?.durationMin ?? null;
    isEstimate = leg?.isEstimate ?? true;
    basis = 'posição atual do motoboy → destino';
  } else if (driverPos && pickup && dropoff) {
    const plan = await routing.route([driverPos, pickup, dropoff]);
    travelMin = plan?.totalDurationMin ?? null;
    isEstimate = plan?.isEstimate ?? true;
    basis = 'motoboy → coleta → destino';
  } else if (pickup && dropoff) {
    const leg = await routing.leg(pickup, dropoff);
    travelMin = leg?.durationMin ?? null;
    basis = 'coleta → destino (motoboy sem localização)';
  } else {
    basis = 'sem coordenadas suficientes';
  }

  if (travelMin == null) {
    // fallback grosseiro por etapa
    const fallback: Record<string, [number, number]> = {
      waiting_dispatch: [35, 60],
      preparing: [30, 50],
      ready: [25, 40],
      assigned: [20, 35],
      picked_up: [12, 22],
      in_route: [8, 16],
    };
    const [min, max] = fallback[order.status] ?? [20, 40];
    return { minMinutes: min, maxMinutes: max, basis: `estimativa por etapa (${basis})`, isEstimate: true, computedAt: new Date().toISOString() };
  }

  // acréscimos por etapa ainda não cumprida
  let overhead = 0;
  if (['waiting_dispatch', 'preparing'].includes(order.status)) overhead += 12; // preparo restante
  if (['waiting_dispatch', 'preparing', 'ready'].includes(order.status)) overhead += 5; // espera do motoboy
  if (order.status === 'assigned') overhead += 3;

  const center = Math.max(travelMin + overhead, 4);

  // dados ruins (GPS absurdo, endereço errado) → não inventa precisão
  if (!Number.isFinite(center) || center > MAX_SANE_ETA_MIN) {
    return null;
  }

  const spread = SPREAD_BY_STATUS[order.status] ?? 0.35;
  const minMinutes = Math.max(3, Math.round(center * (1 - spread)));
  const maxMinutes = Math.max(minMinutes + 4, Math.round(center * (1 + spread)));
  return { minMinutes, maxMinutes, basis, isEstimate, computedAt: new Date().toISOString() };
}

export function formatEta(eta: EtaEstimate | null): string {
  if (!eta) return 'Sem previsão disponível';
  return `Chega em aproximadamente ${eta.minMinutes}–${eta.maxMinutes} minutos`;
}
