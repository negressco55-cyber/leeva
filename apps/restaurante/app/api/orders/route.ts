import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, businessError, serverError } from '@/lib/api';
import { getOrderProvider } from '@leeva/shared/integrations';
import { createOrderFromNormalized } from '@leeva/shared/services';

/** Cria um pedido manual. */
export async function POST(req: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest('JSON inválido');
    }
    if (!body || typeof body !== 'object') return badRequest('corpo inválido');

    const provider = getOrderProvider('manual');
    const parsed = await provider.parse(body);
    if (!parsed.ok) return badRequest(parsed.error);

    const db = adminDb();
    const result = await createOrderFromNormalized(db, ctx.restaurantId, parsed.order);
    if (!result.ok) return businessError(result.error);

    return json({ ok: true, orderId: result.orderId, orderNumber: result.orderNumber });
  } catch (e) {
    return serverError(e);
  }
}
