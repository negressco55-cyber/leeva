import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, badRequest, businessError, serverError, UUID } from '@/lib/api';
import { advanceOrderStatus, acceptDelivery } from '@leeva/shared/services';
import type { OrderStatus } from '@leeva/shared';

/**
 * Ações do motoboy sobre a entrega dele.
 * body: { action: 'accept' } | { action: 'status', status: OrderStatus }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getMotoboyContextFromReq(req);
    if (!ctx) return unauthorized();
    const { id } = await params;
    if (!UUID.test(id)) return badRequest('id inválido');
    const db = adminDb();

    const { data: order } = await db
      .from('orders')
      .select('id, motoboy_id')
      .eq('id', id)
      .maybeSingle();
    if (!order || order.motoboy_id !== ctx.motoboyId) {
      return forbidden('essa entrega não é sua');
    }

    const body = (await req.json().catch(() => ({}))) as { action?: string; status?: OrderStatus };

    if (body.action === 'accept') {
      const r = await acceptDelivery(db, id, ctx.motoboyId);
      return r.ok ? json({ ok: true }) : businessError(r.error);
    }

    if (body.action === 'status' && body.status) {
      const allowed: OrderStatus[] = ['picked_up', 'in_route', 'delivered'];
      if (!allowed.includes(body.status)) {
        return badRequest('status não permitido para motoboy');
      }
      const r = await advanceOrderStatus(db, id, body.status, {
        actorType: 'motoboy',
        actorId: ctx.motoboyId,
      });
      return r.ok ? json({ ok: true }) : businessError(r.error);
    }

    return badRequest('ação inválida');
  } catch (e) {
    return serverError(e);
  }
}
