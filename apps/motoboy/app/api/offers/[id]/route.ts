import { getMotoboyContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, businessError, serverError, UUID } from '@/lib/api';
import { acceptOffer, declineOffer, dispatchTick } from '@leeva/shared/services';

/** body: { action: 'accept' | 'decline', reason?: string } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMotoboyContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  if (!UUID.test(id)) return badRequest('id inválido');
  try {
    const db = adminDb();
    const { action, reason } = (await req.json().catch(() => ({}))) as {
      action?: string;
      reason?: string;
    };

    if (action === 'accept') {
      const r = await acceptOffer(db, id, ctx.motoboyId);
      return r.ok ? json({ ok: true, orderId: r.orderId }) : businessError(r.error);
    }
    if (action === 'decline') {
      const r = await declineOffer(db, id, ctx.motoboyId, reason);
      // libera o pedido para o próximo candidato imediatamente
      if (r.ok) void dispatchTick(db, { source: 'event' }).catch(() => {});
      return r.ok ? json({ ok: true }) : businessError(r.error);
    }
    return badRequest('ação inválida');
  } catch (e) {
    return serverError(e);
  }
}
