import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError, UUID } from '@/lib/api';
import { addCredit } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

/** Admin adiciona crédito (bônus / ajuste de suporte). body: { amount, kind, description } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  if (!UUID.test(id)) return badRequest('id inválido');

  const b = (await req.json().catch(() => ({}))) as { amount?: number; kind?: string; description?: string };
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) return badRequest('valor inválido');
  const kind = b.kind === 'bonus' || b.kind === 'adjustment' ? b.kind : 'adjustment';
  if (!b.description?.trim()) return badRequest('informe o motivo');

  try {
    const balance = await addCredit(adminDb(), id, amount, kind, `[admin] ${b.description.trim().slice(0, 200)}`, {
      createdBy: ctx.userId,
    });
    return json({ ok: true, balance });
  } catch (e) {
    return serverError(e);
  }
}
