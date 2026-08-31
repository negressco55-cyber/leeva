import { requireRestaurantContext, adminDb } from '@/lib/context';
import OrdersBoard from './OrdersBoard';

export const dynamic = 'force-dynamic';

export default async function PedidosPage() {
  const ctx = await requireRestaurantContext();
  const db = adminDb();

  const { data: orders } = await db
    .from('orders')
    .select(
      'id, order_number, source, status, dispatch_state, customer_name, customer_phone, customer_address, region, order_amount, delivery_fee, payment_method, payment_status, motoboy_id, created_at, ready_at, eta_min, eta_max, notes, latitude, longitude, leeva_fee, driver_payout, logistics_margin, route_distance_km, order_items(id, name, quantity, unit_price, notes)',
    )
    .eq('restaurant_id', ctx.restaurantId)
    .order('created_at', { ascending: false })
    .limit(120);

  return (
    <OrdersBoard restaurantId={ctx.restaurantId} initialOrders={JSON.parse(JSON.stringify(orders ?? []))} />
  );
}
