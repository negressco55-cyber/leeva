/**
 * Sistema de eventos — ponto único onde eventos de domínio são registrados
 * e "fanned out" para notificações / analytics. A mudança de status já gera
 * order_events via trigger no banco; este serviço cobre os eventos que a
 * aplicação dispara explicitamente (aceite, "chegando", etc.) e o
 * encaminhamento para as notificações do cliente.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { DomainEvent } from '../types';
import { queueCustomerNotification } from './notifications';

type DB = SupabaseClient<Database>;

export type EmitInput = {
  restaurantId: string;
  orderId: string;
  type: DomainEvent | string;
  actorType?: 'restaurant' | 'motoboy' | 'system' | 'customer' | 'integration';
  actorId?: string | null;
  data?: Record<string, unknown>;
};

/** Eventos que geram notificação para o cliente. */
const CUSTOMER_NOTIFY: Record<string, { template: string; body: string }> = {
  'order.confirmed': { template: 'customer.confirmed', body: 'Seu pedido foi confirmado.' },
  'order.preparing': { template: 'customer.preparing', body: 'Seu pedido está sendo preparado.' },
  'delivery.assigned': { template: 'customer.driver_assigned', body: 'Um entregador está a caminho do restaurante para buscar seu pedido.' },
  'delivery.started': { template: 'customer.out_for_delivery', body: 'Seu pedido saiu para entrega.' },
  'delivery.nearby': { template: 'customer.nearby', body: 'Seu pedido está chegando.' },
  'delivery.delivered': { template: 'customer.delivered', body: 'Seu pedido foi entregue. Bom apetite!' },
};

/**
 * Notificação do cliente ligada a uma mudança de status. NÃO grava
 * order_event (a trigger do banco já registra a transição) — só dispara a
 * notificação, evitando eventos duplicados na timeline.
 */
export async function notifyForStatusChange(
  db: DB,
  args: { restaurantId: string; orderId: string; toStatus: string },
): Promise<void> {
  const map: Record<string, string> = {
    preparing: 'order.confirmed',
    ready: 'order.ready',
    assigned: 'delivery.assigned',
    in_route: 'delivery.started',
    delivered: 'delivery.delivered',
  };
  const key = map[args.toStatus];
  const notify = key ? CUSTOMER_NOTIFY[key] : undefined;
  if (!notify) return;
  await queueCustomerNotification(db, {
    restaurantId: args.restaurantId,
    orderId: args.orderId,
    template: notify.template,
    body: notify.body,
  });
}

export async function emitEvent(db: DB, input: EmitInput): Promise<void> {
  const { error } = await db.from('order_events').insert({
    restaurant_id: input.restaurantId,
    order_id: input.orderId,
    type: input.type,
    actor_type: input.actorType ?? 'system',
    actor_id: input.actorId ?? null,
    data: (input.data ?? {}) as Database['public']['Tables']['order_events']['Insert']['data'],
  });
  if (error) {
    // 23505 = evento "uma vez por pedido" já existe → idempotência, não é erro
    if (error.code !== '23505') {
      console.error('[events] falha ao gravar order_event (ignorado):', error.message);
    }
    return;
  }

  const notify = CUSTOMER_NOTIFY[input.type];
  if (notify) {
    try {
      await queueCustomerNotification(db, {
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        template: notify.template,
        body: notify.body,
      });
    } catch (e) {
      console.error('[events] notificação falhou (ignorado):', (e as Error).message);
    }
  }
}

/** Lê a timeline de um pedido já ordenada. */
export async function getOrderTimeline(db: DB, orderId: string) {
  const { data } = await db
    .from('order_events')
    .select('id, type, actor_type, data, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  return data ?? [];
}
