import { getApiContext, adminDb } from '@/lib/context';
import { unauthorized, forbidden, serverError, businessError, json, orderBelongsTo } from '@/lib/api';
import { markPreparing } from '@leeva/shared/services';

/** Marca o pedido "em preparo". body: { prepEstimateMinutes?: number } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const body = (await req.json().catch(() => ({}))) as { prepEstimateMinutes?: number };
    const result = await markPreparing(db, id, ctx.restaurantId, {
      actorId: ctx.userId,
      prepEstimateMinutes: body.prepEstimateMinutes,
    });
    if (!result.ok) return businessError(result.error);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
