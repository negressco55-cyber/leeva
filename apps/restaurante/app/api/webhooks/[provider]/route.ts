import { adminDb } from '@/lib/context';
import { json, badRequest, serverError, tooManyRequests } from '@/lib/api';
import { processInboundWebhook, checkRateLimit, clientIp, captureError } from '@leeva/shared/services';
import { WhatsAppOrderProvider } from '@leeva/shared/integrations';
import type { IntegrationProvider } from '@leeva/shared';

/** Limite defensivo de tamanho do corpo do webhook (256 KB). */
const MAX_BODY_BYTES = 256 * 1024;
const UUID = /^[0-9a-f-]{36}$/i;

const SUPPORTED: IntegrationProvider[] = ['ifood', 'whatsapp'];

/**
 * Webhook de verificação da WhatsApp Cloud API (hub.challenge).
 * GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider === 'whatsapp') {
    const url = new URL(req.url);
    const challenge = new WhatsAppOrderProvider().verifyChallenge(url.searchParams);
    if (challenge) return new Response(challenge, { status: 200 });
    return new Response('forbidden', { status: 403 });
  }
  return json({ ok: true, provider, note: 'endpoint de webhook ativo' });
}

/**
 * Recebe eventos das integrações externas.
 *
 * Mapeamento de restaurante: `?restaurant=<uuid>` na URL (recomendado, cada
 * restaurante configura seu próprio endpoint). Em ambiente com um único
 * restaurante, cai nele automaticamente. Ver docs/INTEGRATIONS.md.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: providerParam } = await params;
    const provider = providerParam as IntegrationProvider;
    if (!SUPPORTED.includes(provider)) return badRequest('provider não suportado');

    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) return badRequest('payload muito grande');
    let payload: unknown = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return badRequest('payload não é JSON');
    }

    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

    const db = adminDb();
    const url = new URL(req.url);
    let restaurantId = url.searchParams.get('restaurant');
    if (restaurantId && !UUID.test(restaurantId)) return badRequest('restaurant inválido');

    const rl = await checkRateLimit(db, 'webhook', `${provider}:${restaurantId ?? clientIp(req)}`);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter);

    if (!restaurantId) {
      const { data: all } = await db.from('restaurants').select('id').limit(2);
      if (all?.length === 1) restaurantId = all[0]!.id;
    }

    const outcome = await processInboundWebhook(db, {
      provider,
      restaurantId,
      headers,
      rawBody,
      payload,
    });
    return json(outcome.body, outcome.status);
  } catch (e) {
    await captureError(adminDb(), 'webhook', e, { endpoint: 'webhooks' });
    return serverError(e);
  }
}
