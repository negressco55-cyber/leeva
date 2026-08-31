import { getApiContext, adminDb } from '@/lib/context';
import { unauthorized, forbidden, badRequest, serverError, businessError, json, orderBelongsTo } from '@/lib/api';
import { advanceOrderStatus } from '@leeva/shared/services';
import { ORDER_STATUS_FLOW } from '@leeva/shared';
import type { OrderStatus } from '@leeva/shared';

const VALID: OrderStatus[] = [...ORDER_STATUS_FLOW, 'cancelled'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const { status } = (await req.json().catch(() => ({}))) as { status?: OrderStatus };
    if (!status || !VALID.includes(status)) return badRequest('status inválido');

    const result = await advanceOrderStatus(db, id, status, {
      actorType: 'restaurant',
      actorId: ctx.userId,
    });
    if (!result.ok) return businessError(result.error);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
