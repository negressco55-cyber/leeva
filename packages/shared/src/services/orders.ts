/**
 * OrderService — criação (a partir de NormalizedOrder), atribuição de
 * motoboy e avanço de status. Toda a regra de negócio de pedido passa
 * por aqui; componentes de UI só chamam estas funções.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { NormalizedOrder } from '../integrations/types';
import type { OrderStatus } from '../types';
import { canTransition } from '../constants';
import { regionFromAddress, isValidLatLng } from './geo';
import { emitEvent, notifyForStatusChange } from './events';
import { queueNotification } from './notifications';
import { estimateOrderEta } from './eta';
import { finalizeLogisticsForOrder } from './autodispatch';
import { finalizeDeliveryCharge } from './payout';
import { recordDeliveryUsage } from './billing';
import { recordIncident } from './reputation';
import { consumeCreditForOrder, refundCreditForOrder } from './credits';
import { notifyDriver } from './notify-driver';
import type { IncidentOrigin } from '../types';

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

type DB = SupabaseClient<Database>;

/** Valor monetário válido: número finito não-negativo, teto sanitário. */
function clampMoney(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(1_000_000, Math.round(n * 100) / 100));
}

export type CreateResult =
  | { ok: true; orderId: string; orderNumber: number; duplicate: false }
  | { ok: true; orderId: string; orderNumber: number; duplicate: true }
  | { ok: false; error: string };

/**
 * Cria um pedido interno a partir de um NormalizedOrder.
 * Idempotente por (restaurant_id, source, external_id).
 */
export async function createOrderFromNormalized(
  db: DB,
  restaurantId: string,
  n: NormalizedOrder,
  opts: { integrationEventId?: string; requireConfirmation?: boolean; skipCredit?: boolean } = {},
): Promise<CreateResult> {
  // --- idempotência ---
  if (n.externalId) {
    const { data: existing } = await db
      .from('orders')
      .select('id, order_number')
      .eq('restaurant_id', restaurantId)
      .eq('source', n.source)
      .eq('external_id', n.externalId)
      .maybeSingle();
    if (existing) {
      return { ok: true, orderId: existing.id, orderNumber: existing.order_number ?? 0, duplicate: true };
    }
  }

  // coordenadas: só guarda se forem plausíveis
  const lat = isValidLatLng(n.address.latitude, n.address.longitude) ? n.address.latitude : null;
  const lng = lat != null ? n.address.longitude : null;
  const region = n.address.region ?? regionFromAddress(n.address.formatted);

  // --- cliente (upsert por telefone; unique(restaurant_id, phone) evita corrida) ---
  let customerId: string | null = null;
  if (n.customer.phone) {
    const { data: cust } = await db
      .from('customers')
      .upsert(
        {
          restaurant_id: restaurantId,
          phone: n.customer.phone,
          name: n.customer.name,
          address: n.address.formatted,
          latitude: lat,
          longitude: lng,
          region,
        },
        { onConflict: 'restaurant_id,phone' },
      )
      .select('id')
      .maybeSingle();
    customerId = cust?.id ?? null;
  }

  const notesPrefix = opts.requireConfirmation ? '[A CONFIRMAR] ' : '';

  const { data: order, error } = await db
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      source: n.source,
      external_id: n.externalId,
      customer_id: customerId,
      customer_name: n.customer.name.slice(0, 200),
      customer_phone: n.customer.phone?.slice(0, 40) ?? null,
      customer_address: n.address.formatted.slice(0, 500),
      latitude: lat,
      longitude: lng,
      region: region?.slice(0, 120) ?? null,
      // order_amount = valor da VENDA — só interessa quando o pagamento é na
      // entrega (motoboy precisa saber quanto cobrar). Senão, o Leeva não
      // toca no dinheiro da venda.
      order_amount: clampMoney(n.total),
      delivery_fee: 0, // taxa manual removida — o Leeva calcula (finalizeDeliveryCharge)
      payment_method: n.paymentMethod ?? 'unknown',
      payment_status: n.paymentStatus ?? 'pending',
      notes: n.notes ? notesPrefix + n.notes : opts.requireConfirmation ? notesPrefix.trim() : null,
      status: 'waiting_dispatch',
    })
    .select('id, order_number')
    .single();

  if (error || !order) {
    // corrida na constraint de idempotência
    if (error?.code === '23505' && n.externalId) {
      const { data: dup } = await db
        .from('orders')
        .select('id, order_number')
        .eq('restaurant_id', restaurantId)
        .eq('source', n.source)
        .eq('external_id', n.externalId)
        .maybeSingle();
      if (dup) return { ok: true, orderId: dup.id, orderNumber: dup.order_number ?? 0, duplicate: true };
    }
    console.error('[orders] createOrderFromNormalized:', error?.message);
    return { ok: false, error: 'não foi possível criar o pedido' };
  }

  const items = n.items.slice(0, 100); // teto defensivo
  if (items.length) {
    await db.from('order_items').insert(
      items.map((i) => ({
        order_id: order.id,
        restaurant_id: restaurantId,
        name: String(i.name).slice(0, 200),
        quantity: Math.max(1, Math.min(999, Math.round(i.quantity || 1))),
        unit_price: clampMoney(i.unitPrice),
        notes: i.notes?.slice(0, 500) ?? null,
      })),
    );
  }

  if (customerId) {
    const { count } = await db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId);
    await db.from('customers').update({ orders_count: count ?? 1 }).eq('id', customerId);
  }

  if (opts.integrationEventId) {
    await db
      .from('integration_events')
      .update({ order_id: order.id, status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', opts.integrationEventId);
  }

  // TAXA DA ENTREGA — calculada UMA VEZ, aqui. Tudo depois lê o valor gravado.
  let charge: Awaited<ReturnType<typeof finalizeDeliveryCharge>> = null;
  try {
    charge = await finalizeDeliveryCharge(db, order.id, restaurantId);
  } catch (e) {
    console.error('[orders] cálculo da taxa falhou (ignorado):', (e as Error).message);
  }

  // CRÉDITO — desconta o total do saldo. Sem saldo → o pedido NÃO é criado.
  if (!opts.skipCredit && charge && charge.total > 0) {
    try {
      const c = await consumeCreditForOrder(
        db,
        restaurantId,
        charge.total,
        order.id,
        `Entrega #${order.order_number ?? ''} — ${charge.distanceKm ?? '?'} km`,
      );
      if (!c.ok) {
        // rollback: apaga o pedido recém-criado
        await db.from('order_items').delete().eq('order_id', order.id);
        await db.from('orders').delete().eq('id', order.id);
        return {
          ok: false,
          error: `Saldo de créditos insuficiente. Esta entrega custa ${brl(charge.total)} e você tem ${brl(c.balance)}. Compre mais créditos para continuar.`,
        };
      }
    } catch (e) {
      console.error('[orders] débito de crédito falhou (ignorado):', (e as Error).message);
    }
  }

  // dispara o despacho automático (o motor decide o entregador sozinho).
  // Pedidos que exigem confirmação humana (rascunho de WhatsApp) não entram.
  if (!opts.requireConfirmation) {
    try {
      const { data: rst } = await db
        .from('restaurants')
        .select('logistics_config')
        .eq('id', restaurantId)
        .maybeSingle();
      const auto =
        (rst?.logistics_config as { auto_dispatch_enabled?: boolean } | null)?.auto_dispatch_enabled ?? true;
      if (auto) {
        await db.from('orders').update({ dispatch_state: 'searching' }).eq('id', order.id);
      }
    } catch {
      /* não bloqueia a criação do pedido */
    }
  }

  return { ok: true, orderId: order.id, orderNumber: order.order_number ?? 0, duplicate: false };
}

/** Confirma um pedido que estava aguardando (waiting_dispatch -> preparing). */
export async function confirmOrder(db: DB, orderId: string, actorId?: string) {
  return advanceOrderStatus(db, orderId, 'preparing', { actorType: 'restaurant', actorId });
}

export type TransitionResult = { ok: true } | { ok: false; error: string };

/**
 * Avança/muda o status de um pedido com validação da máquina de estados
 * e efeitos colaterais (status do motoboy, ETA, eventos, notificações).
 *
 * A escrita é um compare-and-swap (`.eq('status', statusLido)`): se outra
 * requisição já mudou o status entre a leitura e a escrita, esta falha com
 * "estado mudou" em vez de sobrescrever — evita corrida de transições.
 */
export async function advanceOrderStatus(
  db: DB,
  orderId: string,
  to: OrderStatus,
  actor: { actorType: 'restaurant' | 'motoboy' | 'system'; actorId?: string },
  opts: { cancelReason?: string; cancelOrigin?: IncidentOrigin } = {},
): Promise<TransitionResult> {
  const { data: order } = await db
    .from('orders')
    .select('id, restaurant_id, status, motoboy_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: 'pedido não encontrado' };

  if (order.status === to) return { ok: true };
  if (!canTransition(order.status as OrderStatus, to)) {
    return { ok: false, error: `transição inválida: ${order.status} → ${to}` };
  }

  // compare-and-swap: só grava se o status ainda for o que lemos
  const { data: updated, error } = await db
    .from('orders')
    .update({ status: to })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id');
  if (error) return { ok: false, error: 'falha ao atualizar o pedido' };
  if (!updated || updated.length === 0) {
    // perdeu a corrida: se o resultado já é o desejado, é idempotente (ok);
    // senão, o pedido foi para outro estado no meio do caminho.
    const { data: now } = await db.from('orders').select('status').eq('id', orderId).maybeSingle();
    if (now?.status === to) return { ok: true };
    return { ok: false, error: 'o pedido mudou de estado — recarregue e tente de novo' };
  }

  // efeitos no motoboy
  if (order.motoboy_id) {
    if (to === 'delivered' || to === 'cancelled') {
      const { count } = await db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('motoboy_id', order.motoboy_id)
        .in('status', ['assigned', 'picked_up', 'in_route']);
      if (!count) {
        await db.from('motoboys').update({ status: 'available' }).eq('id', order.motoboy_id);
      }
    } else if (['assigned', 'picked_up', 'in_route'].includes(to)) {
      await db.from('motoboys').update({ status: 'on_delivery' }).eq('id', order.motoboy_id);
    }
  }

  // cancelamento durante busca/oferta → fecha a oferta aberta
  if (to === 'cancelled') {
    await db
      .from('dispatch_attempts')
      .update({ responded_at: new Date().toISOString(), outcome: 'cancelled', reason: 'pedido cancelado' })
      .eq('order_id', orderId)
      .is('responded_at', null);
    await db.from('orders').update({ dispatch_state: 'none' }).eq('id', orderId);

    // estorna o crédito consumido por este pedido
    try {
      await refundCreditForOrder(db, orderId);
    } catch (e) {
      console.error('[orders] estorno de crédito falhou (ignorado):', (e as Error).message);
    }

    // cancelou DEPOIS de aceitar → incidente. A ORIGEM decide se penaliza:
    // problema do restaurante / cliente / sistema NÃO pune o entregador.
    if (order.motoboy_id && ['assigned', 'picked_up', 'in_route'].includes(order.status)) {
      const origin: IncidentOrigin =
        opts.cancelOrigin ??
        (actor.actorType === 'restaurant' ? 'restaurant' : actor.actorType === 'motoboy' ? 'driver' : 'system');
      try {
        await recordIncident(db, {
          motoboyId: order.motoboy_id,
          orderId,
          restaurantId: order.restaurant_id,
          type: order.status === 'assigned' ? 'cancel_after_accept' : 'abandon',
          origin,
          note: opts.cancelReason,
        });
      } catch (e) {
        console.error('[orders] incidente não registrado (ignorado):', (e as Error).message);
      }

      // avisa o motoboy que a entrega que ele aceitou foi cancelada
      try {
        await notifyDriver(db, {
          motoboyId: order.motoboy_id,
          restaurantId: order.restaurant_id,
          orderId,
          kind: 'offer_cancelled',
          title: 'Entrega cancelada',
          body: opts.cancelReason
            ? `A entrega que você aceitou foi cancelada: ${opts.cancelReason}`
            : 'A entrega que você aceitou foi cancelada. Você já pode receber outra.',
          urgent: true,
        });
      } catch (e) {
        console.error('[orders] aviso ao motoboy falhou (ignorado):', (e as Error).message);
      }
    }
  }

  // financeiro da logística + cobrança de uso na conclusão (não quebram a entrega)
  if (to === 'delivered') {
    try {
      await finalizeLogisticsForOrder(db, orderId, order.restaurant_id);
      await recordDeliveryUsage(db, order.restaurant_id, orderId);
    } catch (e) {
      console.error('[orders] finalização financeira falhou (ignorado):', (e as Error).message);
    }
  }

  // a transição já virou order_event via trigger no banco; aqui só
  // disparamos as notificações do cliente. Falha de notificação NUNCA
  // quebra a entrega.
  try {
    await notifyForStatusChange(db, { restaurantId: order.restaurant_id, orderId, toStatus: to });
  } catch (e) {
    console.error('[orders] notificação falhou (ignorado):', (e as Error).message);
  }

  // recalcula ETA nas etapas em que faz sentido
  if (['assigned', 'picked_up', 'in_route'].includes(to)) {
    try {
      const eta = await estimateOrderEta(db, orderId);
      if (eta) {
        await db
          .from('orders')
          .update({ eta_min: eta.minMinutes, eta_max: eta.maxMinutes, eta_computed_at: eta.computedAt })
          .eq('id', orderId);
      }
    } catch (e) {
      console.error('[orders] ETA falhou (ignorado):', (e as Error).message);
    }
  }

  return { ok: true };
}

/**
 * Atribui um motoboy a um pedido (despacho).
 *
 * `opts.reassign` permite trocar o motoboy de um pedido já atribuído
 * (decisão manual do restaurante). Sem isso, o pedido precisa estar SEM
 * motoboy — e a escrita é um compare-and-swap para que dois despachos
 * simultâneos não briguem pelo mesmo pedido.
 */
export async function assignDriver(
  db: DB,
  orderId: string,
  motoboyId: string,
  actor: { actorId?: string; reassign?: boolean } = {},
): Promise<TransitionResult> {
  const { data: order } = await db
    .from('orders')
    .select('id, restaurant_id, status, motoboy_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: 'pedido não encontrado' };
  if (['delivered', 'cancelled'].includes(order.status))
    return { ok: false, error: 'pedido já finalizado' };
  if (order.motoboy_id && order.motoboy_id !== motoboyId && !actor.reassign)
    return { ok: false, error: 'pedido já foi despachado para outro motoboy' };
  if (order.motoboy_id === motoboyId) return { ok: true };

  const { data: motoboy } = await db
    .from('motoboys')
    .select('id, full_name, user_id, max_concurrent_deliveries, active, status, restaurant_id, fleet')
    .eq('id', motoboyId)
    .maybeSingle();
  if (!motoboy || !motoboy.active) return { ok: false, error: 'motoboy indisponível' };
  const belongs = motoboy.fleet === 'leeva' || motoboy.restaurant_id === order.restaurant_id;
  if (!belongs) return { ok: false, error: 'motoboy indisponível' };
  if (motoboy.status === 'offline') return { ok: false, error: 'motoboy está offline' };

  // capacidade
  const { count: activeCount } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('motoboy_id', motoboyId)
    .in('status', ['assigned', 'picked_up', 'in_route']);
  const max = motoboy.max_concurrent_deliveries ?? 3;
  if ((activeCount ?? 0) >= max)
    return { ok: false, error: `motoboy já está com ${activeCount} entregas (limite ${max})` };

  // compare-and-swap sobre o motoboy lido (null ou o antigo em reassign)
  let q = db
    .from('orders')
    .update({ motoboy_id: motoboyId, status: 'assigned', dispatch_state: 'assigned' })
    .eq('id', orderId);
  q = order.motoboy_id ? q.eq('motoboy_id', order.motoboy_id) : q.is('motoboy_id', null);
  const { data: updated, error } = await q.select('id');
  if (error) return { ok: false, error: 'falha ao despachar o pedido' };
  if (!updated || updated.length === 0)
    return { ok: false, error: 'o pedido já foi despachado — recarregue e tente de novo' };

  // fecha oferta aberta (se veio de despacho automático e o restaurante forçou)
  await db
    .from('dispatch_attempts')
    .update({ responded_at: new Date().toISOString(), outcome: 'cancelled', reason: 'atribuição manual' })
    .eq('order_id', orderId)
    .is('responded_at', null);

  // libera o motoboy anterior se não tiver mais entregas
  const prev = order.motoboy_id;
  if (prev && prev !== motoboyId) {
    const { count } = await db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('motoboy_id', prev)
      .in('status', ['assigned', 'picked_up', 'in_route']);
    if (!count) await db.from('motoboys').update({ status: 'available' }).eq('id', prev);
  }

  await db.from('motoboys').update({ status: 'on_delivery' }).eq('id', motoboyId);

  // delivery.assigned já é gravado pela trigger do banco (com motoboy_id no data)

  try {
    await queueNotification(db, {
      restaurantId: order.restaurant_id,
      orderId,
      channel: 'in_app',
      recipientType: 'motoboy',
      template: 'motoboy.new_delivery',
      title: 'Nova entrega',
      body: 'Você recebeu uma nova entrega. Abra o app para aceitar.',
      data: { order_id: orderId },
    });
  } catch (e) {
    console.error('[orders] notificação de despacho falhou (ignorado):', (e as Error).message);
  }

  try {
    await finalizeLogisticsForOrder(db, orderId, order.restaurant_id);
    const eta = await estimateOrderEta(db, orderId);
    if (eta) {
      await db
        .from('orders')
        .update({ eta_min: eta.minMinutes, eta_max: eta.maxMinutes, eta_computed_at: eta.computedAt })
        .eq('id', orderId);
    }
  } catch (e) {
    console.error('[orders] finalização de despacho falhou (ignorado):', (e as Error).message);
  }

  return { ok: true };
}

/** Motoboy aceita a entrega (evento explícito, sem mudar status). Idempotente. */
export async function acceptDelivery(db: DB, orderId: string, motoboyId: string) {
  const { data: order } = await db
    .from('orders')
    .select('restaurant_id, motoboy_id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.motoboy_id !== motoboyId) return { ok: false as const, error: 'entrega não é sua' };
  if (['delivered', 'cancelled'].includes(order.status))
    return { ok: false as const, error: 'essa entrega já foi finalizada' };
  if (order.status !== 'assigned' && order.status !== 'ready')
    return { ok: false as const, error: 'essa entrega não está aguardando aceite' };

  // idempotência: se já aceitou, não emite de novo
  const { data: already } = await db
    .from('order_events')
    .select('id')
    .eq('order_id', orderId)
    .eq('type', 'delivery.accepted')
    .limit(1);
  if (already?.length) return { ok: true as const };

  await emitEvent(db, {
    restaurantId: order.restaurant_id,
    orderId,
    type: 'delivery.accepted',
    actorType: 'motoboy',
    actorId: motoboyId,
  });
  return { ok: true as const };
}

/** Grava um ponto de localização do motoboy (vinculado à entrega ativa). */
export async function recordDriverLocation(
  db: DB,
  input: {
    restaurantId: string;
    motoboyId: string;
    orderId?: string | null;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
  },
) {
  if (!isValidLatLng(input.latitude, input.longitude)) {
    return { ok: false as const, error: 'coordenada inválida' };
  }
  const { error } = await db.from('driver_locations').insert({
    restaurant_id: input.restaurantId,
    motoboy_id: input.motoboyId,
    order_id: input.orderId ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy != null && Number.isFinite(input.accuracy) ? input.accuracy : null,
    speed: input.speed != null && Number.isFinite(input.speed) && input.speed >= 0 ? input.speed : null,
  });
  if (error) return { ok: false as const, error: 'falha ao gravar localização' };

  // "delivery.nearby": se estiver a < 400 m do destino de uma entrega ativa
  if (input.orderId) {
    const { data: order } = await db
      .from('orders')
      .select('restaurant_id, latitude, longitude, status')
      .eq('id', input.orderId)
      .single();
    if (order?.latitude != null && order?.longitude != null && order.status === 'in_route') {
      const distM =
        haversineMeters(input.latitude, input.longitude, order.latitude, order.longitude) ?? Infinity;
      if (distM < 400) {
        const { data: already } = await db
          .from('order_events')
          .select('id')
          .eq('order_id', input.orderId)
          .eq('type', 'delivery.nearby')
          .limit(1);
        if (!already?.length) {
          await emitEvent(db, {
            restaurantId: order.restaurant_id,
            orderId: input.orderId,
            type: 'delivery.nearby',
            actorType: 'system',
            data: { distance_m: Math.round(distM) },
          });
        }
      }
    }
  }
  return { ok: true as const };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
