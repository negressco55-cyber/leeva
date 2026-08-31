import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError, UUID } from '@/lib/api';
import { computeReliabilityIndex } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

/** body: { blocked: boolean, reason?: string } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  if (!UUID.test(id)) return badRequest('id inválido');

  const b = (await req.json().catch(() => ({}))) as { blocked?: boolean; reason?: string };
  const blocked = !!b.blocked;
  if (blocked && !b.reason?.trim()) return badRequest('informe o motivo do bloqueio');

  try {
    const db = adminDb();
    const { data, error } = await db
      .from('motoboys')
      .update({
        blocked,
        blocked_reason: blocked ? b.reason!.trim().slice(0, 300) : null,
        // bloquear tira de disponível para não receber ofertas
        ...(blocked ? { status: 'offline' as const } : {}),
      })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return badRequest('entregador não encontrado');
    await computeReliabilityIndex(db, id).catch(() => {});
    return json({ ok: true, blocked });
  } catch (e) {
    return serverError(e);
  }
}
