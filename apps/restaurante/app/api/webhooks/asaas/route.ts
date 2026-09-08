import { adminDb } from '@/lib/context';
import { json, badRequest, serverError, unauthorized, tooManyRequests } from '@/lib/api';
import {
  confirmCreditPurchase,
  failCreditPurchase,
  checkRateLimit,
  clientIp,
  captureError,
} from '@leeva/shared/services';

/** Corpo máximo aceito de um webhook (128 KB). */
const MAX_BODY_BYTES = 128 * 1024;

/**
 * Webhook da Asaas — confirmação de pagamento das cobranças de crédito.
 *
 * Configuração no painel Asaas (Configurações -> Integrações -> Webhooks):
 *   URL:   https://leeva-restaurante.vercel.app/api/webhooks/asaas
 *   Token: o mesmo valor de ASAAS_WEBHOOK_TOKEN (a Asaas o envia no
 *          cabeçalho `asaas-access-token` a cada chamada)
 *   Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE,
 *            PAYMENT_DELETED, PAYMENT_REFUNDED
 *
 * Sem ASAAS_WEBHOOK_TOKEN no ambiente o endpoint recusa tudo (503) — nada
 * de confirmar pagamento sem validar a origem.
 */
export async function POST(req: Request) {
  try {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!expected) return json({ error: 'webhook Asaas não configurado' }, 503);

    const got = req.headers.get('asaas-access-token') ?? '';
    if (got !== expected) return unauthorized();

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return badRequest('payload muito grande');
    let body: { event?: string; payment?: Record<string, unknown> };
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return badRequest('payload não é JSON');
    }

    const db = adminDb();
    const rl = await checkRateLimit(db, 'webhook', `asaas:${clientIp(req)}`);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter);

    const event = String(body.event ?? '');
    const payment = body.payment ?? {};
    const externalId = typeof payment.id === 'string' ? payment.id : undefined;
    const purchaseId = typeof payment.externalReference === 'string' ? payment.externalReference : undefined;

    if (!externalId && !purchaseId) return json({ ok: true, ignored: 'sem referência' });

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        const r = await confirmCreditPurchase(db, { externalId, purchaseId });
        // "compra não encontrada" = pagamento que não nasceu no Leeva (outra
        // atividade na conta Asaas). Ignora em silêncio; só registra falha real.
        if (!r.ok && !r.alreadyPaid && r.error !== 'compra não encontrada') {
          await captureError(db, 'billing', new Error(r.error ?? 'confirm falhou'), { event, externalId });
        }
        return json({ ok: true, credited: r.ok, alreadyPaid: !!r.alreadyPaid });
      }
      case 'PAYMENT_OVERDUE':
        await failCreditPurchase(db, { externalId, purchaseId }, 'expired');
        return json({ ok: true, marked: 'expired' });
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
        await failCreditPurchase(db, { externalId, purchaseId }, 'failed');
        return json({ ok: true, marked: 'failed' });
      default:
        return json({ ok: true, ignored: event });
    }
  } catch (e) {
    await captureError(adminDb(), 'webhook', e, { endpoint: 'webhooks/asaas' });
    return serverError(e);
  }
}

/** A Asaas faz um GET simples ao validar a URL do webhook. */
export function GET() {
  return json({ ok: true, note: 'webhook Asaas ativo' });
}
