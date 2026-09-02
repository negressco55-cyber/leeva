import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';

/** Ofertas de entrega abertas endereçadas a este motoboy. */
export async function GET(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    const { data: offers } = await db
      .from('dispatch_attempts')
      .select('id, order_id, score, offered_at, expires_at, quality, quality_score, counts_for_acceptance, payout_estimate, distance_pickup_km, distance_total_km, group_order_ids, group_plan')
      .eq('motoboy_id', ctx.motoboyId)
      .is('responded_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('offered_at', { ascending: true });

    const orderIds = (offers ?? []).map((o) => o.order_id);
    const { data: orders } = orderIds.length
      ? await db
          .from('orders')
          .select(
            'id, order_number, customer_name, customer_address, region, latitude, longitude, order_amount, delivery_fee, driver_payout, payment_method, payment_status, notes, group_id, status, restaurant_id, eta_min, eta_max',
          )
          .in('id', orderIds)
      : { data: [] };
    const byId = new Map((orders ?? []).map((o) => [o.id, o]));

    // ponto de coleta (restaurante) — para a prévia da rota no card da oferta
    const restIds = [...new Set((orders ?? []).map((o) => o.restaurant_id).filter(Boolean))];
    const { data: rests } = restIds.length
      ? await db.from('restaurants').select('id, name, address, latitude, longitude').in('id', restIds)
      : { data: [] };
    const restById = new Map((rests ?? []).map((r) => [r.id, r]));

    const result = (offers ?? [])
      .map((off) => {
        const o = byId.get(off.order_id);
        if (!o || !['waiting_dispatch', 'preparing', 'ready'].includes(o.status)) return null;
        const rest = o.restaurant_id ? restById.get(o.restaurant_id) : null;
        const totalKm = off.distance_total_km != null ? Number(off.distance_total_km) : null;
        return {
          offerId: off.id,
          orderId: o.id,
          orderNumber: o.order_number,
          customerName: o.customer_name,
          address: o.customer_address,
          region: o.region,
          dropoffLat: o.latitude != null ? Number(o.latitude) : null,
          dropoffLng: o.longitude != null ? Number(o.longitude) : null,
          pickupName: rest?.name ?? null,
          pickupAddress: rest?.address ?? null,
          pickupLat: rest?.latitude != null ? Number(rest.latitude) : null,
          pickupLng: rest?.longitude != null ? Number(rest.longitude) : null,
          etaMinutes:
            o.eta_min != null
              ? Number(o.eta_min)
              : totalKm != null
                ? Math.round((totalKm / 22) * 60) + 6
                : null,
          expiresAt: off.expires_at,
          payout: off.payout_estimate != null ? Number(off.payout_estimate) : o.driver_payout != null ? Number(o.driver_payout) : null,
          quality: off.quality as 'excellent' | 'good' | 'acceptable' | 'poor' | null,
          countsForAcceptance: !!off.counts_for_acceptance,
          distancePickupKm: off.distance_pickup_km != null ? Number(off.distance_pickup_km) : null,
          distanceTotalKm: off.distance_total_km != null ? Number(off.distance_total_km) : null,
          paymentMethod: o.payment_method,
          paymentStatus: o.payment_status,
          orderAmount: Number(o.order_amount),
          notes: o.notes,
          grouped: !!o.group_id || !!off.group_order_ids?.length,
          routeStops: Array.isArray(off.group_plan)
            ? (off.group_plan as Array<Record<string, unknown>>).map((s) => ({
                seq: Number(s.seq),
                address: String(s.address ?? ''),
                region: (s.region as string | null) ?? null,
                payout: Number(s.payout),
              }))
            : null,
          routeTotalKm: off.distance_total_km != null ? Number(off.distance_total_km) : null,
        };
      })
      .filter(Boolean);

    return json({ offers: result });
  } catch (e) {
    return serverError(e);
  }
}
