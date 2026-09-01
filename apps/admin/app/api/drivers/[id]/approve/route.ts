import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, businessError, serverError, UUID } from '@/lib/api';
import { approveDriver, rejectDriver } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

/** body: { action: 'approve' | 'reject', reason? } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  if (!UUID.test(id)) return badRequest('id inválido');
  const b = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };

  try {
    const db = adminDb();
    if (b.action === 'approve') {
      const r = await approveDriver(db, id, ctx.userId);
      return r.ok ? json({ ok: true }) : businessError('cadastro não está pendente');
    }
    if (b.action === 'reject') {
      const r = await rejectDriver(db, id, ctx.userId, (b.reason ?? 'Não aprovado.').trim() || 'Não aprovado.');
      return r.ok ? json({ ok: true }) : businessError('cadastro não encontrado');
    }
    return badRequest('ação inválida');
  } catch (e) {
    return serverError(e);
  }
}
