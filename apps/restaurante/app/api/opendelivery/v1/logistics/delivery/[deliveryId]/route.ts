import { adminDb } from '@/lib/context';
import { json, UUID } from '@/lib/api';
import { openDeliveryEvent } from '@leeva/shared/integrations';
import { ensureTrackingToken, trackingUrl } from '@leeva/shared/services';
import { restaurantFromOdAuth } from '../../../../auth';

/**
 * Open Delivery — situação da entrega.
 * GET /api/opendelivery/v1/logistics/delivery/{deliveryId}
 * (deliveryId = o que o Leeva devolveu no POST, ou o orderId do cardápio)
 */
export async function GET(req: Request, { params }: { params: Promise<{ deliveryId: string }> }) {
  const db = adminDb();
  const restaurantId = await restaurantFromOdAuth(db, req);
  if (!restaurantId) return json({ title: 'Unauthorized', status: 401 }, 401);

  const { deliveryId } = await params;
  const id = decodeURIComponent(deliveryId).slice(0, 120);
  const q = db
    .from('orders')
    .select('id, external_id, order_number, status, motoboy_id, updated_at')
    .eq('restaurant_id', restaurantId);
  const { data: o } = await (UUID.test(id) ? q.eq('id', id) : q.eq('external_id', id)).maybeSingle();
  if (!o) return json({ title: 'Not Found', status: 404 }, 404);

  let deliveryPerson: { name: string } | undefined;
  if (o.motoboy_id) {
    const { data: m } = await db.from('motoboys').select('full_name').eq('id', o.motoboy_id).maybeSingle();
    if (m) deliveryPerson = { name: m.full_name.split(' ')[0] ?? m.full_name };
  }
  const token = o.status === 'cancelled' ? null : await ensureTrackingToken(db, o.id).catch(() => null);
  return json({
    deliveryId: o.id,
    orderId: o.external_id,
    orderDisplayId: o.order_number,
    event: openDeliveryEvent(o.status),
    deliveryPerson,
    trackingUrl: token ? trackingUrl(token) : undefined,
    updatedAt: o.updated_at,
  });
}
