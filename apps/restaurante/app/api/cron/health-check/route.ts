import { adminDb } from '@/lib/context';
import { json, serverError } from '@/lib/api';
import { getDispatchHealth, sendOpsAlertEmail, captureError } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALERT_TO = process.env.OPS_ALERT_EMAIL;
const RESEND_MINUTES = 30;

/**
 * Checa se o motor de despacho está rodando e manda e-mail se parou/deu erro.
 * Agendado via pg_cron a cada ~5min. Protegido por CRON_SECRET.
 * Não manda e-mail de novo a cada execução enquanto o problema persiste
 * (só depois de RESEND_MINUTES), e avisa uma vez quando volta ao normal.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: 'endpoint desativado: defina CRON_SECRET' }, 503);
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (provided.length !== secret.length || provided !== secret) {
    return json({ error: 'não autorizado' }, 401);
  }
  if (!ALERT_TO) return json({ ok: true, skipped: 'OPS_ALERT_EMAIL não configurado' });

  const db = adminDb();
  try {
    const health = await getDispatchHealth(db);

    const { data: prev } = await db
      .from('platform_alert_state')
      .select('last_status, last_sent_at')
      .eq('key', 'dispatch_health')
      .maybeSingle();

    const wasDown = prev?.last_status === 'warn' || prev?.last_status === 'down';
    const isDown = health.status === 'warn' || health.status === 'down';
    const minutesSinceLastSend = prev?.last_sent_at
      ? (Date.now() - new Date(prev.last_sent_at).getTime()) / 60000
      : Infinity;

    let sent = false;
    if (isDown && (!wasDown || minutesSinceLastSend >= RESEND_MINUTES)) {
      sent = await sendOpsAlertEmail(
        ALERT_TO,
        'motor de despacho com problema',
        health.message,
      );
    } else if (!isDown && wasDown) {
      sent = await sendOpsAlertEmail(ALERT_TO, 'motor de despacho normalizado', health.message);
    }

    await db.from('platform_alert_state').upsert({
      key: 'dispatch_health',
      last_status: health.status,
      last_sent_at: sent ? new Date().toISOString() : (prev?.last_sent_at ?? null),
      updated_at: new Date().toISOString(),
    });

    return json({ ok: true, status: health.status, sent });
  } catch (e) {
    await captureError(db, 'cron', e, { endpoint: 'health-check' });
    return serverError(e);
  }
}
