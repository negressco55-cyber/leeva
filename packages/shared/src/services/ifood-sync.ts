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
  IfoodApiError,
  type IfoodPollEvent,
} from '../integrations/ifood-client';
import { getValidIfoodAccessToken, IfoodNotLinkedError } from './ifood-link';
import { createOrderFromNormalized } from './orders';
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
