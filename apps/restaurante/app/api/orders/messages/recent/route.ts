import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';

/** Últimas conversas do restaurante — 1 linha por pedido com mensagem,
 *  pra alimentar o painel "Chats abertos". */
export async function GET() {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const db = adminDb();

    const { data: msgs } = await db
      .from('order_messages')
      .select('id, order_id, sender_type, body, created_at')
      .eq('restaurant_id', ctx.restaurantId)
      .order('created_at', { ascending: false })
      .limit(300);

    const byOrder = new Map<string, { id: string; senderType: string; body: string; createdAt: string }>();
    for (const m of msgs ?? []) {
      if (!byOrder.has(m.order_id)) {
        byOrder.set(m.order_id, { id: m.id, senderType: m.sender_type, body: m.body, createdAt: m.created_at });
      }
    }
    const orderIds = [...byOrder.keys()];
    if (!orderIds.length) return json({ conversations: [] });

    const { data: orders } = await db
      .from('orders')
      .select('id, order_number, customer_name, status')
      .in('id', orderIds);

    const conversations = (orders ?? [])
      .map((o) => ({
        orderId: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name,
        status: o.status,
        lastMessage: byOrder.get(o.id)!,
      }))
      .sort((a, b) => (a.lastMessage.createdAt < b.lastMessage.createdAt ? 1 : -1));

    return json({ conversations });
  } catch (e) {
    return serverError(e);
  }
}
