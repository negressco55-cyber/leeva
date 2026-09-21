import { requireMotoboyContext, adminDb } from '@/lib/context';
import DeliveryFlow from './DeliveryFlow';

export const dynamic = 'force-dynamic';

export default async function EntregaPage() {
  const ctx = await requireMotoboyContext();
  const db = adminDb();

  const { data: orders } = await db
    .from('orders')
    .select(
      'id, order_number, status, customer_name, customer_phone, customer_address, latitude, longitude, order_amount, delivery_fee, driver_payout, payment_method, payment_status, notes, eta_min, eta_max, ready_at, preparing_at, prep_estimate_minutes, source, ifood_locator, order_items(name, quantity, notes)',
    )
    .eq('motoboy_id', ctx.motoboyId)
    // 'preparing'/'ready' também contam: o despacho sincronizado pode
    // atribuir o motoboy ANTES do pedido ficar pronto.
    .in('status', ['preparing', 'ready', 'assigned', 'picked_up', 'in_route'])
    .order('assigned_at', { ascending: true })
    .limit(20);

  const ids = (orders ?? []).map((o) => o.id);
  const { data: acceptedEvents } = ids.length
    ? await db
        .from('order_events')
        .select('order_id')
        .in('order_id', ids)
        .eq('type', 'delivery.accepted')
    : { data: [] };
  const acceptedIds = new Set((acceptedEvents ?? []).map((e) => e.order_id));

  const deliveries = (orders ?? []).map((o) => ({
    ...o,
    accepted: acceptedIds.has(o.id),
  }));

  const { data: rst } = ctx.restaurantId
    ? await db.from('restaurants').select('phone').eq('id', ctx.restaurantId).maybeSingle()
    : { data: null };

  return (
    <DeliveryFlow
      motoboyId={ctx.motoboyId}
      restaurantId={ctx.restaurantId}
      restaurantPhone={rst?.phone ?? null}
      deliveries={JSON.parse(JSON.stringify(deliveries))}
    />
  );
}
