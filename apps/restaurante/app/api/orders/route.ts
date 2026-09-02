import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, businessError, serverError } from '@/lib/api';
import { getOrderProvider } from '@leeva/shared/integrations';
import {
  createOrderFromNormalized,
  resolveDeliveryLocation,
  deliveryLocationErrorMessage,
  regionFromAddress,
} from '@leeva/shared/services';

/** Cria um pedido manual. */
export async function POST(req: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return badRequest('JSON inválido');
    }
    if (!body || typeof body !== 'object') return badRequest('corpo inválido');

    const provider = getOrderProvider('manual');
    const parsed = await provider.parse(body);
    if (!parsed.ok) return badRequest(parsed.error);

    const db = adminDb();

    // VALIDAÇÃO DO ENDEREÇO — antes de criar/calcular. Endereço inventado
    // não passa; instabilidade do geocoder pede confirmação, não bloqueia.
    const loc = await resolveDeliveryLocation(db, ctx.restaurantId, {
      address: parsed.order.address.formatted,
      latitude: parsed.order.address.latitude,
      longitude: parsed.order.address.longitude,
      confirmed: body.addressConfirmed === true,
    });
    if (!loc.ok) {
      return json(
        { error: deliveryLocationErrorMessage(loc.reason), code: loc.reason },
        loc.reason === 'geocoder_unavailable' ? 503 : 400,
      );
    }
    parsed.order.address.latitude = loc.latitude;
    parsed.order.address.longitude = loc.longitude;
    if (!parsed.order.address.region) {
      parsed.order.address.region = regionFromAddress(loc.label ?? parsed.order.address.formatted);
    }

    const result = await createOrderFromNormalized(db, ctx.restaurantId, parsed.order);
    if (!result.ok) {
      return json({ error: result.error, code: result.code }, result.code === 'address_not_found' ? 400 : 422);
    }

    return json({ ok: true, orderId: result.orderId, orderNumber: result.orderNumber });
  } catch (e) {
    return serverError(e);
  }
}
