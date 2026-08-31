import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { computeDeliveryCharge, getCreditBalance } from '@leeva/shared/services';

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
    const db = adminDb();
    const [charge, credit] = await Promise.all([
      computeDeliveryCharge(db, ctx.restaurantId, { latitude: lat, longitude: lng }),
      getCreditBalance(db, ctx.restaurantId),
    ]);
    return json({
      ok: true,
      ...charge,
      balance: credit.balance,
      sufficient: credit.balance >= charge.total,
    });
  } catch (e) {
    return serverError(e);
  }
}
