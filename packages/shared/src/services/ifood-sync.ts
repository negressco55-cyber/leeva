/**
 * Importação de pedidos do iFood — modelo de POLLING (não webhook).
 *
 *   getValidIfoodAccessToken(restaurantId) → pollIfoodEvents → (evento PLC)
 *     → getIfoodOrder → IFoodOrderProvider.parse() → resolveAndApplyDeliveryLocation
 *     → createOrderFromNormalized → acknowledgeIfoodEvents
 *
 * O restaurante precisa ter concluído o vínculo (ver services/ifood-link.ts —
 * fluxo authorization_code + userCode, obrigatório pra apps distribuídos)
 * antes de haver o que sincronizar.
 *
 * Idempotência: cada evento do iFood vira uma linha em `integration_events`
 * (unique por provider+event_id) ANTES de criar o pedido — reprocessar o
 * mesmo evento (reenvio do iFood, ou dois pollers rodando) não duplica.
 *
 * Endereço: todo pedido passa pela mesma validação de endereço dos outros
 * canais (services/address.ts) — um endereço do iFood mal formatado não
 * gera pedido nem tarifa, igual ao manual.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { getOrderProvider } from '../integrations/registry';
import {
  pollIfoodEvents,
  acknowledgeIfoodEvents,
  getIfoodOrder,
  IFOOD_EVENT_NEW_ORDER,
  IFOOD_EVENT_CONCLUDED,
  IFOOD_EVENT_CANCELLED,
  IfoodApiError,
  type IfoodPollEvent,
} from '../integrations/ifood-client';
import { getValidIfoodAccessToken, IfoodNotLinkedError } from './ifood-link';
import { createOrderFromNormalized, advanceOrderStatus } from './orders';
import { resolveAndApplyDeliveryLocation, deliveryLocationErrorMessage } from './address';
import { isValidLatLng } from './geo';

type DB = SupabaseClient<Database>;

export type IfoodSyncResult = {
  ok: boolean;
  merchantIds: string[];
  polled: number;
  imported: number;
  skipped: number;
  errors: string[];
};

/**
 * Um ciclo de sincronização pra UM restaurante já vinculado: renova o
 * access token se preciso, busca eventos, importa pedidos novos e confirma
 * o recebimento de TODOS os eventos buscados (mesmo os que não geram
 * pedido) — é obrigatório pro iFood parar de reenviar.
 */
export async function syncIfoodOrders(db: DB, restaurantId: string): Promise<IfoodSyncResult> {
  const errors: string[] = [];
  let token: string;
  let merchantIds: string[];
  try {
    const auth = await getValidIfoodAccessToken(db, restaurantId);
    token = auth.token;
    merchantIds = auth.merchantIds;
  } catch (e) {
    const msg = e instanceof IfoodNotLinkedError ? e.message : (e as Error).message;
    return { ok: false, merchantIds: [], polled: 0, imported: 0, skipped: 0, errors: [msg] };
  }

  // "Chamar entregador automaticamente para pedidos do iFood?" (default sim).
  // Se não, o pedido entra segurado — aparece no painel/mapa, mas só despacha
  // e desconta crédito quando o restaurante clicar "Chamar entregador".
  const { data: rst } = await db
    .from('restaurants')
    .select('logistics_config')
    .eq('id', restaurantId)
    .maybeSingle();
  const autoCall =
    (rst?.logistics_config as { ifood_auto_call?: boolean } | null)?.ifood_auto_call ?? true;

  let events: IfoodPollEvent[];
  try {
    events = await pollIfoodEvents(token, merchantIds.length ? merchantIds : undefined);
  } catch (e) {
    return { ok: false, merchantIds, polled: 0, imported: 0, skipped: 0, errors: [...errors, (e as Error).message] };
  }

  let imported = 0;
  let skipped = 0;
  const provider = getOrderProvider('ifood');

  for (const evt of events) {
    try {
      // idempotência: registra o evento antes de agir
      const { error: insErr } = await db
        .from('integration_events')
        .insert({
          restaurant_id: restaurantId,
          provider: 'ifood',
          direction: 'inbound',
          event_id: evt.id,
          signature_valid: true, // autenticidade vem do token OAuth, não de HMAC
          status: 'received',
          payload: evt as unknown as Database['public']['Tables']['integration_events']['Insert']['payload'],
        });
      if (insErr) {
        if (insErr.code === '23505') {
          skipped++; // já processado antes
          continue;
        }
        errors.push(`evento ${evt.id}: falha ao registrar (${insErr.message})`);
        continue;
      }

      // pedido concluído / cancelado no iFood → fecha o pedido no Leeva também,
      // mesmo que a entrega NÃO tenha sido nossa (segurado / recusado).
      if ((evt.code === IFOOD_EVENT_CONCLUDED || evt.code === IFOOD_EVENT_CANCELLED) && evt.orderId) {
        const outcome = evt.code === IFOOD_EVENT_CONCLUDED ? 'concluded' : 'cancelled';
        const r = await closeIfoodOrder(db, restaurantId, evt.orderId, outcome);
        await db
          .from('integration_events')
          .update({ status: r.ok ? 'processed' : 'failed', processed_at: new Date().toISOString(), error: r.ok ? null : r.action })
          .eq('provider', 'ifood')
          .eq('event_id', evt.id);
        if (r.ok) imported++;
        else skipped++;
        continue;
      }

      if (evt.code !== IFOOD_EVENT_NEW_ORDER || !evt.orderId) {
        skipped++;
        continue;
      }

      const raw = await getIfoodOrder(token, evt.orderId);
      const parsed = await provider.parse(raw);
      if (!parsed.ok) {
        errors.push(`pedido ${evt.orderId}: ${parsed.error}`);
        await db.from('integration_events').update({ status: 'failed', error: parsed.error }).eq('provider', 'ifood').eq('event_id', evt.id);
        continue;
      }

      // mesma validação de endereço dos outros canais (bloco 1) — um
      // endereço do iFood mal formatado não vira pedido nem tarifa
      const hasCoords = isValidLatLng(parsed.order.address.latitude, parsed.order.address.longitude);
      const loc = await resolveAndApplyDeliveryLocation(db, restaurantId, parsed.order, { confirmed: hasCoords });
      if (!loc.ok) {
        const msg = deliveryLocationErrorMessage(loc.reason);
        errors.push(`pedido ${evt.orderId}: ${msg}`);
        await db.from('integration_events').update({ status: 'failed', error: loc.reason }).eq('provider', 'ifood').eq('event_id', evt.id);
        continue;
      }

      const created = await createOrderFromNormalized(db, restaurantId, parsed.order, {
        integrationEventId: undefined,
        holdForReview: !autoCall,
      });
      if (!created.ok) {
        errors.push(`pedido ${evt.orderId}: ${created.error}`);
        await db.from('integration_events').update({ status: 'failed', error: created.error }).eq('provider', 'ifood').eq('event_id', evt.id);
        continue;
      }

      await db
        .from('integration_events')
        .update({ status: 'processed', order_id: created.orderId, processed_at: new Date().toISOString() })
        .eq('provider', 'ifood')
        .eq('event_id', evt.id);
      imported++;
    } catch (e) {
      errors.push(`evento ${evt.id}: ${(e as Error).message}`);
    }
  }

  // confirma TODOS os eventos buscados — obrigatório mesmo pros que não
  // viraram pedido (senão o iFood reenvia)
  try {
    await acknowledgeIfoodEvents(token, events.map((e) => e.id));
  } catch (e) {
    errors.push(`acknowledgment: ${(e as Error).message}`);
  }

  return { ok: errors.length === 0, merchantIds, polled: events.length, imported, skipped, errors };
}

export { IfoodApiError };

/**
 * Fecha o pedido do Leeva a partir de um status final do iFood.
 *
 * - `cancelled`  → cancela no Leeva (estorna crédito, encerra oferta).
 * - `concluded`  → se a entrega foi NOSSA e está em rota, conclui pelo fluxo
 *   normal; senão (pedido segurado, recusado, ou sem motoboy) marca como
 *   entregue "por fora" (`delivery_gps_status = 'external'`), sem cobrar
 *   entregador nem crédito.
 */
export async function closeIfoodOrder(
  db: DB,
  restaurantId: string,
  externalId: string,
  outcome: 'concluded' | 'cancelled',
): Promise<{ ok: boolean; action: string }> {
  const { data: order } = await db
    .from('orders')
    .select('id, status, dispatch_hold, motoboy_id')
    .eq('restaurant_id', restaurantId)
    .eq('source', 'ifood')
    .eq('external_id', externalId)
    .maybeSingle();
  if (!order) return { ok: false, action: 'not_found' };
  if (['delivered', 'cancelled'].includes(order.status)) return { ok: true, action: 'already_closed' };

  if (outcome === 'cancelled') {
    const r = await advanceOrderStatus(
      db,
      order.id,
      'cancelled',
      { actorType: 'system' },
      { cancelOrigin: 'system', cancelReason: 'cancelado no iFood' },
    );
    return { ok: r.ok, action: 'cancelled' };
  }

  // concluído
  if (order.motoboy_id && !order.dispatch_hold && order.status === 'in_route') {
    const r = await advanceOrderStatus(db, order.id, 'delivered', { actorType: 'system' });
    return { ok: r.ok, action: 'delivered_by_us' };
  }

  // não foi entrega nossa — fecha como externa (bypass da máquina de estados,
  // de propósito: não é uma entrega Leeva normal)
  const { error } = await db
    .from('orders')
    .update({
      status: 'delivered',
      delivery_gps_status: 'external',
      dispatch_hold: false,
      dispatch_state: 'none',
    })
    .eq('id', order.id)
    .not('status', 'in', '("delivered","cancelled")');
  return { ok: !error, action: error ? 'update_failed' : 'delivered_external' };
}
