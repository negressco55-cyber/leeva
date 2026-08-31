import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { computeDeliveryCharge } from '@leeva/shared/services';

/**
 * Pré-visualização da taxa da entrega — o restaurante vê ANTES de criar
 * quanto vai custar (e o detalhe entregador + Leeva). Não grava nada.
 * GET /api/delivery-fee?latitude=..&longitude=..
 */
export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get('latitude'));
  const lng = Number(sp.get('longitude'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ ok: false, error: 'informe a localização da entrega' }, 200);
  }
  try {
    const charge = await computeDeliveryCharge(adminDb(), ctx.restaurantId, { latitude: lat, longitude: lng });
    return json({ ok: true, ...charge });
  } catch (e) {
    return serverError(e);
  }
}
