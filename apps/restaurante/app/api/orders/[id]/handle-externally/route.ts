import { getApiContext, adminDb } from '@/lib/context';
import { unauthorized, forbidden, serverError, businessError, json, orderBelongsTo } from '@/lib/api';
import { markOrderHandledExternally } from '@leeva/shared/services';

/**
 * "Recusar" um pedido segurado (dispatch_hold): o restaurante entrega por
 * conta própria. Fecha no Leeva como "entregue por fora", sem custo.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    if (ctx.role !== 'restaurant_owner') return forbidden();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const r = await markOrderHandledExternally(db, id, ctx.restaurantId);
    if (!r.ok) return businessError(r.error ?? 'não foi possível recusar');
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
