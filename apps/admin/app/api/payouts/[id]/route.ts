import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, businessError, serverError, UUID } from '@/lib/api';
import { retryPayoutBatch, markPayoutBatchPaid } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

/** body: { action: 'retry' | 'mark_paid', note? } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  if (!UUID.test(id)) return badRequest('id inválido');
  const b = (await req.json().catch(() => ({}))) as { action?: string; note?: string };

  try {
    const db = adminDb();
    if (b.action === 'retry') {
      const r = await retryPayoutBatch(db, id);
      return r.ok ? json({ ok: true }) : businessError(r.error ?? 'falha ao reprocessar');
    }
    if (b.action === 'mark_paid') {
      if (!b.note?.trim()) return badRequest('informe a nota');
      const r = await markPayoutBatchPaid(db, id, b.note.trim());
      return r.ok ? json({ ok: true }) : businessError('lote já pago');
    }
    return badRequest('ação inválida');
  } catch (e) {
    return serverError(e);
  }
}
