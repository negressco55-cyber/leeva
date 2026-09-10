import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, businessError, serverError } from '@/lib/api';
import { getOrderProvider } from '@leeva/shared/integrations';
import { createOrderFromNormalized, resolveAndApplyDeliveryLocation, deliveryLocationErrorMessage } from '@leeva/shared/services';

/**
 * Cria um PEDIDO DE TESTE pela mesma porta da API pública, pra o restaurante
 * confirmar que a integração de cardápio funciona ponta a ponta. O pedido
 * vai pro endereço do próprio restaurante e fica marcado como teste.
 */
export async function POST() {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    if (ctx.role !== 'restaurant_owner') return forbidden('só o dono testa a integração');
    const db = adminDb();

    const { data: rst } = await db
      .from('restaurants')
      .select('address, latitude, longitude')
      .eq('id', ctx.restaurantId)
      .maybeSingle();
    if (!rst?.address || rst.latitude == null) {
      return json(
        { error: 'Defina o endereço do restaurante em Configurações antes de testar.', code: 'no_address' },
        400,
      );
    }

    const provider = getOrderProvider('api');
    const parsed = await provider.parse({
      external_order_id: `TESTE-${Date.now()}`,
      customer_name: 'PEDIDO DE TESTE — pode cancelar',
      customer_phone: '',
      address: rst.address,
      latitude: rst.latitude,
      longitude: rst.longitude,
      payment_method: 'online',
      payment_status: 'paid',
      order_value: 0,
      notes: 'Pedido de teste da integração. Não é real.',
    });
    if (!parsed.ok) return businessError(parsed.error);

    const loc = await resolveAndApplyDeliveryLocation(db, ctx.restaurantId, parsed.order, { confirmed: true });
    if (!loc.ok) return json({ error: deliveryLocationErrorMessage(loc.reason) }, 422);

    const r = await createOrderFromNormalized(db, ctx.restaurantId, parsed.order, { holdForReview: true });
    if (!r.ok) return businessError(r.error);

    return json({ ok: true, orderNumber: r.orderNumber });
  } catch (e) {
    return serverError(e);
  }
}
