import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, badRequest, serverError, UUID } from '@/lib/api';
import { getOrderMessages, sendOrderMessage } from '@leeva/shared/services';

/** Chat do pedido — lado do motoboy. Só a entrega dele. */
async function loadOrder(db: ReturnType<typeof adminDb>, id: string) {
  return db.from('orders').select('id, motoboy_id, restaurant_id').eq('id', id).maybeSingle();
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMotoboyContextFromReq(req);
    if (!ctx) return unauthorized();
    const { id } = await params;
    if (!UUID.test(id)) return badRequest('id inválido');
    const db = adminDb();

    const { data: order } = await loadOrder(db, id);
    if (!order || order.motoboy_id !== ctx.motoboyId) return forbidden('essa entrega não é sua');

    const messages = await getOrderMessages(db, id);
    return json({ messages });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMotoboyContextFromReq(req);
    if (!ctx) return unauthorized();
    const { id } = await params;
    if (!UUID.test(id)) return badRequest('id inválido');
    const db = adminDb();

    const { data: order } = await loadOrder(db, id);
    if (!order || order.motoboy_id !== ctx.motoboyId) return forbidden('essa entrega não é sua');

    const { body } = (await req.json().catch(() => ({}))) as { body?: string };
    if (!body?.trim()) return badRequest('mensagem vazia');

    const result = await sendOrderMessage(db, id, order.restaurant_id, 'motoboy', ctx.motoboyId, body);
    if (!result.ok) return badRequest(result.error ?? 'não foi possível enviar');

    await db.from('notifications').insert({
      restaurant_id: order.restaurant_id,
      order_id: id,
      channel: 'in_app',
      recipient_type: 'restaurant',
      recipient: order.restaurant_id,
      template: 'restaurant.driver_message',
      title: 'Mensagem do entregador',
      body: body.trim().slice(0, 120),
      status: 'sent',
      sent_at: new Date().toISOString(),
    }).then(() => {}, () => {});

    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
