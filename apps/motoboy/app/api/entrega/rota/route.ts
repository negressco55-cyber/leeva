import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, businessError, serverError, UUID } from '@/lib/api';
import { getMotoboyRoute, reorderMotoboyRoute, resetMotoboyRoute, pickUpAllForMotoboy } from '@leeva/shared/services';

/** Rota atual do motoboy (ordem + link do Google Maps com todas as paradas). */
export async function GET(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    return json({ route: await getMotoboyRoute(adminDb(), ctx.motoboyId) });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Ações do motoboy na rota dele.
 * body:
 *   { action: 'reorder', orderIds: string[] }  ← a ordem que ele quer fazer
 *   { action: 'reset' }                        ← volta pra ordem sugerida
 *   { action: 'pickup_all' }                   ← "retirei todos" no restaurante
 */
export async function POST(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; orderIds?: unknown };
    const db = adminDb();

    if (body.action === 'reorder') {
      const ids = Array.isArray(body.orderIds) ? body.orderIds.filter((x): x is string => typeof x === 'string' && UUID.test(x)) : [];
      if (!ids.length || ids.length > 30) return badRequest('orderIds inválido');
      const r = await reorderMotoboyRoute(db, ctx.motoboyId, ids);
      return r.ok ? json({ ok: true, route: r.route }) : businessError(r.error);
    }
    if (body.action === 'reset') {
      return json({ ok: true, route: await resetMotoboyRoute(db, ctx.motoboyId) });
    }
    if (body.action === 'pickup_all') {
      const r = await pickUpAllForMotoboy(db, ctx.motoboyId);
      if (!r.count && r.errors.length) return businessError(r.errors[0]!);
      return json({ ok: true, count: r.count });
    }
    return badRequest('ação inválida');
  } catch (e) {
    return serverError(e);
  }
}
