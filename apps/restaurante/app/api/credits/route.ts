import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, badRequest, serverError } from '@/lib/api';
import { getCreditBalance, getCreditHistory, getCreditPackages, addCredit } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    const [balance, history, packages] = await Promise.all([
      getCreditBalance(db, ctx.restaurantId),
      getCreditHistory(db, ctx.restaurantId, 50),
      getCreditPackages(db),
    ]);
    return json({ ...balance, history, packages });
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Compra de crédito.
 *
 * BLOCO 2 — MODO SIMULAÇÃO: credita na hora, sem pagamento real.
 * BLOCO 3 substitui isto por: gera cobrança Pix na Asaas → webhook confirma
 * → aí sim `addCredit`. Nada de crédito manual em produção.
 */
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'restaurant_owner') return forbidden('só o dono compra créditos');

  const b = (await req.json().catch(() => ({}))) as { packageId?: string; amount?: number };
  const db = adminDb();

  let amount = 0;
  let bonus = 0;
  if (b.packageId) {
    const pkgs = await getCreditPackages(db);
    const p = pkgs.find((x) => x.id === b.packageId);
    if (!p) return badRequest('pacote inválido');
    amount = p.amount;
    bonus = p.bonus;
  } else if (b.amount && b.amount > 0) {
    amount = Math.min(5000, Math.round(Number(b.amount) * 100) / 100);
  } else {
    return badRequest('informe um pacote ou valor');
  }

  try {
    let balance = await addCredit(db, ctx.restaurantId, amount, 'purchase', `Compra de crédito (simulação) — ${amount.toFixed(2)}`, {
      createdBy: ctx.userId,
    });
    if (bonus > 0) {
      balance = await addCredit(db, ctx.restaurantId, bonus, 'bonus', `Bônus do pacote — ${bonus.toFixed(2)}`);
    }
    return json({ ok: true, balance, simulated: true });
  } catch (e) {
    return serverError(e);
  }
}
