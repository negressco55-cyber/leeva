import { adminDb } from '@/lib/context';
import { json, badRequest, businessError, serverError, tooManyRequests } from '@/lib/api';
import { getOrderProvider } from '@leeva/shared/integrations';
import {
  createOrderFromNormalized,
  checkRateLimit,
  resolveApiKey,
  resolveAndApplyDeliveryLocation,
  deliveryLocationErrorMessage,
  isValidLatLng,
} from '@leeva/shared/services';

const MAX_BODY_BYTES = 128 * 1024;

/**
 * Intake de pedidos do cardápio próprio / API do Leeva.
 * Autenticação: header `x-leeva-api-key` (comparada por hash SHA-256 com
 * `integrations.config.api_key_hash`). Em dev, aceita `LEEVA_API_KEY` como
 * chave global se houver um único restaurante. Ver docs/INTEGRATIONS.md.
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

    const rl = await checkRateLimit(db, 'deliveries', restaurantId);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter);

    const provider = getOrderProvider('menu');
    const parsed = await provider.parse(body);
    if (!parsed.ok) return badRequest(parsed.error);

    const hasCoords = isValidLatLng(parsed.order.address.latitude, parsed.order.address.longitude);
    const loc = await resolveAndApplyDeliveryLocation(db, restaurantId, parsed.order, { confirmed: hasCoords });
    if (!loc.ok) {
      return json(
        { error: deliveryLocationErrorMessage(loc.reason), code: loc.reason },
        loc.reason === 'geocoder_unavailable' ? 503 : 422,
      );
    }

    const result = await createOrderFromNormalized(db, restaurantId, parsed.order);
    if (!result.ok) return businessError(result.error);
    return json({
      ok: true,
      order_id: result.orderId,
      order_number: result.orderNumber,
      duplicate: result.duplicate,
    });
  } catch (e) {
    return serverError(e);
  }
}
