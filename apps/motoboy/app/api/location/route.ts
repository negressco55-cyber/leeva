import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { recordDriverLocation } from '@leeva/shared/services';

/**
 * Recebe a localização do motoboy. Só grava se ele estiver com entrega
 * ativa (economia de bateria/dados + privacidade). Coordenadas inválidas
 * são recusadas.
 */
export async function POST(req: Request) {
  try {
    const ctx = await getMotoboyContextFromReq(req);
    if (!ctx) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      speed?: number;
    };
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return badRequest('latitude/longitude obrigatórios');
    }

    const db = adminDb();
    const { data: activeOrder } = await db
      .from('orders')
      .select('id, restaurant_id')
      .eq('motoboy_id', ctx.motoboyId)
      .in('status', ['assigned', 'picked_up', 'in_route'])
      .order('assigned_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!activeOrder) {
      return json({ ok: true, stored: false, reason: 'sem entrega ativa' });
    }

    // a localização pertence ao restaurante DA ENTREGA (importante para a rede)
    const result = await recordDriverLocation(db, {
      restaurantId: activeOrder.restaurant_id,
      motoboyId: ctx.motoboyId,
      orderId: activeOrder.id,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy,
      speed: body.speed,
    });
    if (!result.ok) return badRequest(result.error);
    return json({ ok: true, stored: true });
  } catch (e) {
    return serverError(e);
  }
}
