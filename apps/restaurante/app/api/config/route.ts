import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, badRequest, serverError } from '@/lib/api';
import {
  DEFAULT_LOGISTICS_CONFIG,
  DEFAULT_PAYOUT_CONFIG,
  getPayoutPolicy,
  computeDriverPayout,
} from '@leeva/shared/services';
import type { LogisticsConfig, PayoutConfig } from '@leeva/shared';
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

export async function PUT(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'restaurant_owner') return forbidden('Apenas o dono pode alterar a configuração.');
  try {
    const body = (await req.json().catch(() => ({}))) as {
      fleetMode?: string;
      latitude?: number;
      longitude?: number;
      logistics?: Partial<LogisticsConfig>;
      payout?: Partial<PayoutConfig>;
    };
    const db = adminDb();

    const warnings: string[] = [];

    // --- logistics_config validado ---
    const L = body.logistics ?? {};
    const logistics: LogisticsConfig = {
      service_radius_km: num(L.service_radius_km, 1, 50, DEFAULT_LOGISTICS_CONFIG.service_radius_km),
      customer_fee: num(L.customer_fee, 0, 100, DEFAULT_LOGISTICS_CONFIG.customer_fee),
      free_delivery_min_order:
        L.free_delivery_min_order == null ? null : num(L.free_delivery_min_order, 0, 100000, 0),
      min_order: num(L.min_order, 0, 100000, 0),
      grouping_enabled: L.grouping_enabled ?? true,
      auto_dispatch_enabled: L.auto_dispatch_enabled ?? true,
      offer_timeout_seconds: num(L.offer_timeout_seconds, 15, 300, DEFAULT_LOGISTICS_CONFIG.offer_timeout_seconds),
      max_dispatch_attempts: num(L.max_dispatch_attempts, 1, 10, DEFAULT_LOGISTICS_CONFIG.max_dispatch_attempts),
    };

    // --- payout validado + aviso de prejuízo ---
    const P = body.payout ?? {};
    const payout: PayoutConfig = {
      base: num(P.base, 0, 100, DEFAULT_PAYOUT_CONFIG.base),
      per_km: num(P.per_km, 0, 20, DEFAULT_PAYOUT_CONFIG.per_km),
      free_km: num(P.free_km, 0, 20, DEFAULT_PAYOUT_CONFIG.free_km),
      grouped_extra: num(P.grouped_extra, 0, 50, DEFAULT_PAYOUT_CONFIG.grouped_extra),
      peak_bonus: num(P.peak_bonus, 0, 50, DEFAULT_PAYOUT_CONFIG.peak_bonus),
      peak_hours: Array.isArray(P.peak_hours) ? P.peak_hours : DEFAULT_PAYOUT_CONFIG.peak_hours,
      min_payout: num(P.min_payout, 0, 100, DEFAULT_PAYOUT_CONFIG.min_payout),
    };

    // simula uma entrega de 3 km para checar viabilidade
    const sample = computeDriverPayout(payout, { distanceKm: 3, groupSize: 1 });
    if (sample.total > logistics.customer_fee) {
      warnings.push(
        `A taxa cobrada do cliente (R$ ${logistics.customer_fee.toFixed(2)}) é menor que a remuneração estimada do entregador (R$ ${sample.total.toFixed(2)}). Você teria prejuízo nessa entrega.`,
      );
    }
    if (payout.base < payout.min_payout) {
      warnings.push('O valor base é menor que o mínimo — toda entrega receberá o ajuste ao mínimo.');
    }

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

    const { data: existingPolicy } = await db
      .from('payout_policies')
      .select('id')
      .eq('restaurant_id', ctx.restaurantId)
      .maybeSingle();
    if (existingPolicy) {
      await db.from('payout_policies').update({ config: payout, active: true }).eq('id', existingPolicy.id);
    } else {
      await db
        .from('payout_policies')
        .insert({ restaurant_id: ctx.restaurantId, name: 'Política do restaurante', config: payout, active: true });
    }

    return json({ ok: true, warnings });
  } catch (e) {
    return serverError(e);
  }
}
