import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { recordPlatformWithdrawal } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

/**
 * Registra que o Leeva sacou `amount` da própria margem. Não move dinheiro
 * nenhum — a transferência de verdade é feita por fora, no painel da Asaas.
 * Isto aqui é só o livro-razão, pra nunca sacar mais do que a margem
 * disponível (ver getAdminTreasury).
 */
export async function POST(req: Request) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { amount?: number; description?: string };
    if (!body.amount || !Number.isFinite(body.amount) || body.amount <= 0) {
      return badRequest('valor inválido');
    }
    const r = await recordPlatformWithdrawal(
      adminDb(),
      body.amount,
      body.description?.trim() || 'Saque da margem do Leeva',
      ctx.userId,
    );
    if (!r.ok) return badRequest(r.error ?? 'não foi possível registrar');
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
