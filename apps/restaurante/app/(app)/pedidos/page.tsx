import { requireRestaurantContext, adminDb } from '@/lib/context';
import OrdersBoard from './OrdersBoard';

export const dynamic = 'force-dynamic';

export default async function PedidosPage() {
  const ctx = await requireRestaurantContext();
  const db = adminDb();

  const { data: orders } = await db
    .from('orders')
    .select(
      'id, order_number, source, status, dispatch_state, customer_name, customer_phone, customer_address, region, order_amount, delivery_fee, payment_method, payment_status, motoboy_id, created_at, ready_at, eta_min, eta_max, notes, latitude, longitude, leeva_fee, driver_payout, logistics_margin, route_distance_km, group_id, group_sequence, order_items(id, name, quantity, unit_price, notes)',
    )
    .eq('restaurant_id', ctx.restaurantId)
    .order('created_at', { ascending: false })
    .limit(120);

  // "agrupado com X e Y": mapa group_id -> paradas da rota (ordenadas)
  const groupPeers: Record<string, { orderNumber: number | null; customerName: string; seq: number | null }[]> = {};
  for (const o of orders ?? []) {
    if (!o.group_id) continue;
    (groupPeers[o.group_id] ??= []).push({
      orderNumber: o.order_number,
      customerName: o.customer_name,
      seq: o.group_sequence,
    });
  }
  for (const g of Object.values(groupPeers)) g.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  return (
    <OrdersBoard
      restaurantId={ctx.restaurantId}
      initialOrders={JSON.parse(JSON.stringify(orders ?? []))}
      groupPeers={groupPeers}
    />
  );
}
