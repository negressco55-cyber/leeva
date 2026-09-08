import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, badRequest, serverError } from '@/lib/api';
import {
  getCreditBalance,
  getCreditHistory,
  getCreditPackages,
  startCreditPurchase,
} from '@leeva/shared/services';

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
 * Com ASAAS_API_KEY no ambiente: gera uma cobrança Pix real (devolve
 * invoiceUrl + copia-e-cola). O crédito só entra quando o webhook da Asaas
 * confirmar o pagamento (/api/webhooks/asaas).
 *
 * Sem ASAAS_API_KEY: MODO SIMULAÇÃO — credita na hora (comportamento de dev,
 * sinalizado com `simulated: true`).
 */
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'restaurant_owner') return forbidden('só o dono compra créditos');

  const b = (await req.json().catch(() => ({}))) as { packageId?: string; amount?: number };
  const db = adminDb();

  try {
    const r = await startCreditPurchase(
      db,
      ctx.restaurantId,
      { packageId: b.packageId, amount: b.amount },
      { createdBy: ctx.userId },
    );
    if (!r.ok) return badRequest(r.error);
    return json(r);
  } catch (e) {
    return serverError(e);
  }
}
