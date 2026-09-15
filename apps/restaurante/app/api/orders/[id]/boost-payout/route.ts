import { getApiContext, adminDb } from '@/lib/context';
import { unauthorized, forbidden, badRequest, serverError, json, orderBelongsTo } from '@/lib/api';

/**
 * Reforça o valor pago ao motoboy neste pedido — usado quando o despacho
 * está demorando (poucos entregadores na região) e o restaurante quer
 * atrair alguém mais rápido. Some do pedido quando um motoboy aceita
 * (finalizeLogisticsForOrder já grava o valor exato que foi ofertado).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const body = (await req.json().catch(() => ({}))) as { amount?: number };
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100) return badRequest('valor inválido (até R$ 100)');

    const { data: order } = await db.from('orders').select('motoboy_id, status').eq('id', id).maybeSingle();
    if (!order || order.motoboy_id) return badRequest('pedido já tem motoboy — não dá pra reforçar mais');

    await db.from('orders').update({ payout_boost: amount }).eq('id', id);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
