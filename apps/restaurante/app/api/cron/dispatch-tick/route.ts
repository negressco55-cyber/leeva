import { adminDb } from '@/lib/context';
import { json, serverError } from '@/lib/api';
import { dispatchTick, recomputeAllReliability, captureError, checkRateLimit } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * LOOP GLOBAL DO MOTOR DE DESPACHO — cron real de produção.
 *
 * Agendado via pg_cron + pg_net (ver docs/DEPLOY.md), a cada ~30 s.
 * Também aceita Vercel Cron / GitHub Actions.
 *
 * - Protegido por CRON_SECRET (nunca público).
 * - Idempotente: `dispatchTick` usa um LEASE com TTL — duas execuções
 *   sobrepostas não processam a mesma oferta.
 * - A cada N ciclos recalcula o índice de confiabilidade dos entregadores.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: 'endpoint desativado: defina CRON_SECRET' }, 503);
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (provided.length !== secret.length || provided !== secret) {
    return json({ error: 'não autorizado' }, 401);
  }

  const db = adminDb();

  // defesa extra: no máx. ~4 execuções por 30 s
  const rl = await checkRateLimit(db, 'default', 'cron:dispatch-tick', { limit: 4, windowSeconds: 30 });
  if (!rl.allowed) return json({ ok: true, skipped: true, reason: 'rate_limited' });

  try {
    const result = await dispatchTick(db, { source: 'cron' });

    // recomputo periódico de reputação (~1x/min, barato o suficiente)
    let reputation: { updated: number } | undefined;
    if (!result.skipped && Math.random() < 0.5) {
      reputation = await recomputeAllReliability(db).catch(() => undefined);
    }

    return json({ ok: true, ...result, reputation });
  } catch (e) {
    await captureError(db, 'cron', e, { endpoint: 'dispatch-tick' });
    return serverError(e);
  }
}
