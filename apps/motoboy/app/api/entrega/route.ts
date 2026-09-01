import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';

/**
 * Entrega(s) ativa(s) do motoboy — JSON para o app nativo. Mesma consulta
 * que a página /entrega da versão PWA usa.
 */
export async function GET(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    const { data: orders } = await db
      .from('orders')
      .select(
        'id, order_number, status, customer_name, customer_phone, customer_address, latitude, longitude, order_amount, driver_payout, payment_method, payment_status, notes, eta_min, eta_max, group_id, group_sequence, restaurant_id',
      )
      .eq('motoboy_id', ctx.motoboyId)
      .in('status', ['assigned', 'picked_up', 'in_route'])
      .order('assigned_at', { ascending: true })
      .limit(20);

    const restIds = [...new Set((orders ?? []).map((o) => o.restaurant_id))];
    const { data: rests } = restIds.length
      ? await db.from('restaurants').select('id, name, address, latitude, longitude').in('id', restIds)
      : { data: [] };
    const byRest = new Map((rests ?? []).map((r) => [r.id, r]));

    const deliveries = (orders ?? []).map((o) => {
      const r = byRest.get(o.restaurant_id);
      return {
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        dropoffAddress: o.customer_address,
        dropoffLat: o.latitude != null ? Number(o.latitude) : null,
        dropoffLng: o.longitude != null ? Number(o.longitude) : null,
        pickupName: r?.name ?? 'Restaurante',
        pickupAddress: r?.address ?? null,
        pickupLat: r?.latitude != null ? Number(r.latitude) : null,
        pickupLng: r?.longitude != null ? Number(r.longitude) : null,
        payout: o.driver_payout != null ? Number(o.driver_payout) : null,
        orderAmount: Number(o.order_amount ?? 0),
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        notes: o.notes,
        etaMin: o.eta_min,
        etaMax: o.eta_max,
        groupId: o.group_id,
        groupSequence: o.group_sequence,
      };
    });

    return json({ deliveries });
  } catch (e) {
    return serverError(e);
  }
}
