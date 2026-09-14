import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { getPayoutHistory, getPendingEarnings, payoutTransferFee } from '@leeva/shared/services';

/** Saldo + histórico de repasses do motoboy — JSON para a aba Carteira do app nativo. */
export async function GET(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    const todayStr = new Date().toISOString().slice(0, 10);
    const [pending, history, requestedTodayRow] = await Promise.all([
      getPendingEarnings(db, ctx.motoboyId),
      getPayoutHistory(db, ctx.motoboyId, 30),
      db.from('payout_batches').select('id').eq('motoboy_id', ctx.motoboyId).eq('period_date', todayStr).maybeSingle(),
    ]);
    return json({
      pendingAmount: pending.amount,
      pendingCount: pending.count,
      requestedToday: !!requestedTodayRow.data,
      transferFee: payoutTransferFee(),
      history: history.map((h) => ({
        id: h.id,
        periodDate: h.periodDate,
        amount: h.amount,
        transferFee: h.transferFee,
        netAmount: h.netAmount,
        earningsCount: h.earningsCount,
        status: h.status,
        simulated: h.simulated,
        paidAt: h.paidAt,
        error: h.error,
      })),
    });
  } catch (e) {
    return serverError(e);
  }
}
