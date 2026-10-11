import { adminDb } from '@/lib/context';
import { json, badRequest, tooManyRequests } from '@/lib/api';
import { intakeDelivery } from '@/lib/intake';
import { openDeliveryToFlat, type OpenDeliveryRequest } from '@leeva/shared/integrations';
import { checkRateLimit, captureError } from '@leeva/shared/services';
import { restaurantFromOdAuth } from '../../../auth';

const MAX_BODY_BYTES = 128 * 1024;

/**
 * Open Delivery — pedido de entrega (lado logística).
 * POST /api/opendelivery/v1/logistics/delivery
 * O cardápio/PDV pede um entregador; o Leeva cria a entrega e despacha pra
 * equipe do estabelecimento. Idempotente por orderId.
 */
export async function POST(req: Request) {
  const db = adminDb();
  try {
    const restaurantId = await restaurantFromOdAuth(db, req);
    if (!restaurantId) return json({ title: 'Unauthorized', status: 401 }, 401);

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return badRequest('payload muito grande');
    let body: OpenDeliveryRequest;
    try {
      body = JSON.parse(raw) as OpenDeliveryRequest;
    } catch {
      return badRequest('JSON inválido');
    }
    if (!body || typeof body !== 'object') return badRequest('corpo inválido');

    const rl = await checkRateLimit(db, 'deliveries', restaurantId);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter);

    const r = await intakeDelivery(db, restaurantId, openDeliveryToFlat(body));
    if (!r.ok) return json({ title: r.error, status: r.status, code: r.code }, r.status);

    return json({ deliveryId: r.orderId, event: 'PENDING', orderDisplayId: r.orderNumber }, 202);
  } catch (e) {
    await captureError(db, 'api', e, { endpoint: 'opendelivery/delivery' });
    return json({ title: 'erro interno', status: 500 }, 500);
  }
}
