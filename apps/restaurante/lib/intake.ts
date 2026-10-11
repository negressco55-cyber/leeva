import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@leeva/shared/types';
import { getOrderProvider } from '@leeva/shared/integrations';
import {
  createOrderFromNormalized,
  dispatchTick,
  resolveAndApplyDeliveryLocation,
  deliveryLocationErrorMessage,
  isRestaurantOpen,
  closedMessage,
  isValidLatLng,
  type BusinessHours,
} from '@leeva/shared/services';

export type IntakeResult =
  | { ok: true; orderId: string; orderNumber: number | null; duplicate: boolean }
  | { ok: false; status: number; error: string; code?: string };

/**
 * Entrada de uma entrega vinda de sistema externo (API do Leeva, Open
 * Delivery…), já no corpo "plano" da API. Valida horário e endereço, cria o
 * pedido (idempotente por external_order_id) e acorda o despacho.
 */
export async function intakeDelivery(
  db: SupabaseClient<Database>,
  restaurantId: string,
  flat: unknown,
): Promise<IntakeResult> {
  const { data: rst } = await db.from('restaurants').select('business_hours').eq('id', restaurantId).maybeSingle();
  const hours = rst?.business_hours as BusinessHours | null;
  if (!isRestaurantOpen(hours)) return { ok: false, status: 422, error: closedMessage(hours) };

  const parsed = await getOrderProvider('api').parse(flat);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  // sistema externo que já manda lat/lng é tratado como "confirmado"
  const hasCoords = isValidLatLng(parsed.order.address.latitude, parsed.order.address.longitude);
  const loc = await resolveAndApplyDeliveryLocation(db, restaurantId, parsed.order, { confirmed: hasCoords });
  if (!loc.ok) {
    return {
      ok: false,
      status: loc.reason === 'geocoder_unavailable' ? 503 : 422,
      error: deliveryLocationErrorMessage(loc.reason),
      code: loc.reason,
    };
  }

  const result = await createOrderFromNormalized(db, restaurantId, parsed.order);
  if (!result.ok) return { ok: false, status: 422, error: result.error };

  if (!result.duplicate) void dispatchTick(db, { source: 'event', restaurantId }).catch(() => {});
  return { ok: true, orderId: result.orderId, orderNumber: result.orderNumber, duplicate: !!result.duplicate };
}
