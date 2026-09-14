import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';

/** Histórico de entregas do motoboy (concluídas + canceladas) — JSON p/ o app nativo. */
export async function GET(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    const { data: orders } = await db
      .from('orders')
      .select('id, order_number, status, customer_name, customer_address, driver_payout, created_at, delivered_at, cancelled_at')
      .eq('motoboy_id', ctx.motoboyId)
      .in('status', ['delivered', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(60);

    const items = (orders ?? []).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      customerName: o.customer_name,
      address: o.customer_address,
      payout: o.driver_payout != null ? Number(o.driver_payout) : 0,
      createdAt: o.created_at,
      finishedAt: o.delivered_at ?? o.cancelled_at,
    }));

    const delivered = items.filter((i) => i.status === 'delivered');
    const totalEarned = delivered.reduce((s, i) => s + i.payout, 0);

    return json({ items, deliveredCount: delivered.length, totalEarned });
  } catch (e) {
    return serverError(e);
  }
}
