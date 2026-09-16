import { getApiContext, adminDb } from '@/lib/context';
import { unauthorized, forbidden, badRequest, serverError, json, orderBelongsTo } from '@/lib/api';
import { getOrderMessages, sendOrderMessage, notifyDriver } from '@leeva/shared/services';

/** Chat do pedido — lado do restaurante. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const messages = await getOrderMessages(db, id);
    return json({ messages });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const { body } = (await req.json().catch(() => ({}))) as { body?: string };
    if (!body?.trim()) return badRequest('mensagem vazia');

    const result = await sendOrderMessage(db, id, ctx.restaurantId, 'restaurant', ctx.userId, body);
    if (!result.ok) return badRequest(result.error ?? 'não foi possível enviar');

    const { data: order } = await db.from('orders').select('motoboy_id, order_number').eq('id', id).maybeSingle();
    if (order?.motoboy_id) {
      await notifyDriver(db, {
        motoboyId: order.motoboy_id,
        restaurantId: ctx.restaurantId,
        orderId: id,
        kind: 'generic',
        title: `Mensagem do restaurante — pedido #${order.order_number}`,
        body: body.trim().slice(0, 120),
        url: '/entrega',
      }).catch(() => {});
    }

    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
