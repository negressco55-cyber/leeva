import { adminDb } from '@/lib/context';
import { json, serverError } from '@/lib/api';
import { closePayoutBatches, captureError } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * FECHAMENTO DIÁRIO DO REPASSE AO MOTOBOY.
 * Agendado via pg_cron 1x/dia (~03:00). Protegido por CRON_SECRET.
 * Soma os ganhos pendentes de cada motoboy → 1 lote → transferência Pix
 * (Asaas ou SIMULAÇÃO enquanto não há credencial).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: 'endpoint desativado: defina CRON_SECRET' }, 503);
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (provided.length !== secret.length || provided !== secret) {
    return json({ error: 'não autorizado' }, 401);
  }
  const db = adminDb();
  try {
    const result = await closePayoutBatches(db);
    return json({ ok: true, ...result });
  } catch (e) {
    await captureError(db, 'billing', e, { endpoint: 'payout-closing' });
    return serverError(e);
  }
}
