import { adminDb } from '@/lib/context';
import { json, badRequest, businessError, serverError, tooManyRequests } from '@/lib/api';
import { getOrderProvider } from '@leeva/shared/integrations';
import { createOrderFromNormalized, dispatchTick, checkRateLimit, captureError, resolveApiKey } from '@leeva/shared/services';

const MAX_BODY_BYTES = 128 * 1024;

/**
 * API DE ENTRADA DE ENTREGAS — o sistema do restaurante envia os dados
 * LOGÍSTICOS de um pedido (não a venda). O Leeva cria a entrega e o motor
 * de despacho automático assume.
 *
 * Auth: header `x-leeva-api-key`.
 * Idempotência: `external_order_id` + restaurante — o mesmo pedido externo
 * nunca cria duas entregas.
 *
 * Body:
 *   external_order_id, customer_name, customer_phone, address,
 *   latitude, longitude, region, payment_method, payment_status,
 *   order_value, notes, items? (opcional)
 */
export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-leeva-api-key');
    if (!apiKey || apiKey.length < 16) return json({ error: 'chave de API inválida' }, 401);

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return badRequest('payload muito grande');
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      return badRequest('JSON inválido');
    }
    if (!body || typeof body !== 'object') return badRequest('corpo inválido');

    const db = adminDb();
    const resolved = await resolveApiKey(db, apiKey);
    if (!resolved) return json({ error: 'chave de API inválida' }, 401);
    const restaurantId = resolved.restaurantId;

    // rate limit por restaurante (janela deslizante no banco)
    const rl = await checkRateLimit(db, 'deliveries', restaurantId);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter);

    const provider = getOrderProvider('api');
    const parsed = await provider.parse(body);
    if (!parsed.ok) return badRequest(parsed.error);

    const result = await createOrderFromNormalized(db, restaurantId, parsed.order);
    if (!result.ok) return businessError(result.error);

    // dá um empurrão no motor de despacho automático
    if (!result.duplicate) void dispatchTick(db, { source: 'event', restaurantId }).catch(() => {});

    return json(
      {
        ok: true,
        delivery_id: result.orderId,
        order_number: result.orderNumber,
        duplicate: result.duplicate,
        status: result.duplicate ? 'existing' : 'accepted',
        dispatch: result.duplicate ? undefined : 'searching_driver',
      },
      result.duplicate ? 200 : 201,
    );
  } catch (e) {
    await captureError(adminDb(), 'api', e, { endpoint: 'v1/deliveries' });
    return serverError(e);
  }
}
