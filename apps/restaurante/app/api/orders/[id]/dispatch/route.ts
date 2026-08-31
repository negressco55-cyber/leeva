import { getApiContext, adminDb } from '@/lib/context';
import { unauthorized, forbidden, badRequest, serverError, businessError, json, orderBelongsTo } from '@/lib/api';
import { assignDriver, recommendDriver } from '@leeva/shared/services';

/** Despacha um pedido: body { motoboyId } OU { auto: true }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const body = (await req.json().catch(() => ({}))) as {
      motoboyId?: string;
      auto?: boolean;
      reassign?: boolean;
    };

    let motoboyId = body.motoboyId;
    if (!motoboyId && body.auto) {
      const rec = await recommendDriver(db, id);
      if (!rec.recommended) return businessError(rec.note ?? 'Nenhum motoboy disponível');
      motoboyId = rec.recommended.motoboyId;
    }
    if (!motoboyId || !/^[0-9a-f-]{36}$/i.test(motoboyId)) return badRequest('motoboyId inválido');

    const result = await assignDriver(db, id, motoboyId, {
      actorId: ctx.userId,
      reassign: body.reassign === true,
    });
    if (!result.ok) return businessError(result.error);
    return json({ ok: true, motoboyId });
  } catch (e) {
    return serverError(e);
  }
}
