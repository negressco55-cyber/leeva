import { adminDb } from '@/lib/context';
import { json, serverError } from '@/lib/api';

/**
 * Retenção de dados. Chamar via cron externo (Vercel Cron, GitHub Action, …)
 * com header `x-cron-secret: $CRON_SECRET`.
 *
 * Requer CRON_SECRET configurado — sem ele o endpoint fica desativado
 * (503), nunca aberto. Ver docs/DATA-RETENTION.md.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return json({ error: 'endpoint desativado: defina CRON_SECRET' }, 503);
  }
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (provided.length !== secret.length || provided !== secret) {
    return json({ error: 'não autorizado' }, 401);
  }
  try {
    const db = adminDb();
    const { data, error } = await db.rpc('cleanup_driver_locations', {});
    if (error) return serverError(error.message);
    return json({ ok: true, deleted_driver_locations: data });
  } catch (e) {
    return serverError(e);
  }
}
