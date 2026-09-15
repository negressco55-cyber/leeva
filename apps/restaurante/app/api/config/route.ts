import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, serverError } from '@/lib/api';
import { DEFAULT_LOGISTICS_CONFIG, getPayoutPolicy } from '@leeva/shared/services';
import type { LogisticsConfig } from '@leeva/shared';
import type { Database } from '@leeva/shared/types';

const num = (v: unknown, min: number, max: number, dflt: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dflt;
  return Math.min(max, Math.max(min, n));
};

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    const { data: rst } = await db
      .from('restaurants')
      .select('fleet_mode, logistics_config, latitude, longitude, address, name')
      .eq('id', ctx.restaurantId)
      .maybeSingle();
    const payout = await getPayoutPolicy(db, ctx.restaurantId);
    return json({
      fleetMode: rst?.fleet_mode ?? 'leeva',
      name: rst?.name,
      address: rst?.address,
      latitude: rst?.latitude,
      longitude: rst?.longitude,
      logistics: { ...DEFAULT_LOGISTICS_CONFIG, ...((rst?.logistics_config as object) ?? {}) },
      payout,
    });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Taxas e remuneração (taxa do cliente, pedido mínimo, frete grátis,
 * per_km/mínimo do motoboy) NÃO são mais editáveis pelo restaurante —
 * só o admin da plataforma mexe nisso (apps/admin/restaurantes/[id]).
 * O restaurante só ajusta o operacional: raio, tempos, ligar/desligar
 * despacho automático e agrupamento.
 */
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'restaurant_owner') return forbidden('Apenas o dono pode alterar a configuração.');
  try {
    const body = (await req.json().catch(() => ({}))) as {
      fleetMode?: string;
      latitude?: number;
      longitude?: number;
      logistics?: Partial<LogisticsConfig>;
    };
    const db = adminDb();

    const { data: current } = await db
      .from('restaurants')
      .select('logistics_config')
      .eq('id', ctx.restaurantId)
      .maybeSingle();
    const existing: LogisticsConfig = { ...DEFAULT_LOGISTICS_CONFIG, ...((current?.logistics_config as object) ?? {}) };

    const L = body.logistics ?? {};
    const logistics: LogisticsConfig = {
      ...existing,
      // definidos só pelo admin — nunca aceitos daqui, mesmo se vierem no body
      customer_fee: existing.customer_fee,
      min_order: existing.min_order,
      free_delivery_min_order: existing.free_delivery_min_order,
      max_dispatch_attempts: existing.max_dispatch_attempts,
      service_radius_km: num(L.service_radius_km, 1, 50, existing.service_radius_km),
      grouping_enabled: L.grouping_enabled ?? existing.grouping_enabled,
      auto_dispatch_enabled: L.auto_dispatch_enabled ?? existing.auto_dispatch_enabled,
      ifood_auto_call: L.ifood_auto_call ?? existing.ifood_auto_call,
      offer_timeout_seconds: num(L.offer_timeout_seconds, 15, 300, existing.offer_timeout_seconds),
      default_prep_minutes: num(L.default_prep_minutes, 1, 120, existing.default_prep_minutes),
      dispatch_lead_minutes: num(L.dispatch_lead_minutes, 0, 60, existing.dispatch_lead_minutes),
    };

    const fleetMode = ['own', 'leeva', 'hybrid'].includes(body.fleetMode ?? '')
      ? body.fleetMode
      : undefined;

    const upd: Database['public']['Tables']['restaurants']['Update'] = {
      logistics_config: logistics as unknown as Database['public']['Tables']['restaurants']['Update']['logistics_config'],
    };
    if (fleetMode) upd.fleet_mode = fleetMode as 'own' | 'leeva' | 'hybrid';
    if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
      upd.latitude = body.latitude;
      upd.longitude = body.longitude;
    }
    await db.from('restaurants').update(upd).eq('id', ctx.restaurantId);

    return json({ ok: true, warnings: [] });
  } catch (e) {
    return serverError(e);
  }
}
