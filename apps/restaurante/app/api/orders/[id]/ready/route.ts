import { getApiContext, adminDb } from '@/lib/context';
import { unauthorized, forbidden, serverError, businessError, json, orderBelongsTo } from '@/lib/api';
import { markReady } from '@leeva/shared/services';

/** Marca o pedido "pronto pra retirada". */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const result = await markReady(db, id, ctx.restaurantId, ctx.userId);
    if (!result.ok) return businessError(result.error);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
