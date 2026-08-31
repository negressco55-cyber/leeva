/**
 * "O QUE ESTÁ ACONTECENDO?" — interpreta o estado atual da operação e
 * devolve uma leitura acionável (menos números, mais decisões).
 * Regras determinísticas.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { STAGE_SLA_MINUTES } from '../constants';
import { plural, motoboysDisponiveis } from '../utils';

type DB = SupabaseClient<Database>;

export type Situation = {
  level: 'ok' | 'warning' | 'critical';
  emoji: string;
  headline: string;
  lines: string[];
  action: string | null;
  counters: {
    total: number;
    toDispatch: number;
    inRoute: number;
    late: number;
    driversAvailable: number;
    driversOnDelivery: number;
  };
};

const minsSince = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 60000 : null);

export async function getSituation(db: DB, restaurantId: string): Promise<Situation> {
  const { data: rst } = await db
    .from('restaurants')
    .select('fleet_mode')
    .eq('id', restaurantId)
    .maybeSingle();
  const fleetMode = rst?.fleet_mode ?? 'leeva';
  const usesNetwork = fleetMode === 'leeva' || fleetMode === 'hybrid';

  const { data: openOrders } = await db
    .from('orders')
    .select('id, order_number, status, created_at, dispatch_state')
    .eq('restaurant_id', restaurantId)
    .in('status', ['waiting_dispatch', 'preparing', 'ready', 'assigned', 'picked_up', 'in_route'])
    .order('created_at', { ascending: true })
    .limit(500);

  const { data: motoboys } = await db
    .from('motoboys')
    .select('id, status')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .limit(500);

  const orders = openOrders ?? [];
  const toDispatch = orders.filter((o) => ['waiting_dispatch', 'preparing', 'ready'].includes(o.status)).length;
  const inRoute = orders.filter((o) => ['picked_up', 'in_route'].includes(o.status)).length;
  const searching = orders.filter((o) => ['searching', 'offered'].includes(o.dispatch_state ?? '')).length;
  const dispatchFailed = orders.filter((o) => o.dispatch_state === 'failed').length;
  const late = orders.filter((o) => {
    const m = minsSince(o.created_at);
    return m != null && m > STAGE_SLA_MINUTES.total && o.status !== 'in_route';
  }).length;
  const driversAvailable = (motoboys ?? []).filter((m) => m.status === 'available').length;
  const driversOnDelivery = (motoboys ?? []).filter((m) => m.status === 'on_delivery').length;

  const counters = {
    total: orders.length,
    toDispatch,
    inRoute,
    late,
    driversAvailable,
    driversOnDelivery,
  };

  // --- regras, da mais grave para a mais leve ---

  // rede/hybrid: quando o motor não acha entregador
  if (usesNetwork && dispatchFailed >= 1) {
    return {
      level: 'critical',
      emoji: '🔴',
      headline: 'Sem entregador disponível',
      lines: [
        `${plural(dispatchFailed, 'pedido')} sem entregador — a rede está sem capacidade para a demanda agora.`,
        searching > 0 ? `${plural(searching, 'pedido')} ainda buscando.` : '',
      ].filter(Boolean),
      action:
        fleetMode === 'hybrid'
          ? 'O Leeva segue tentando. Se tiver frota própria, coloque-a online.'
          : 'O Leeva segue tentando automaticamente. Avise os clientes sobre possível atraso.',
      counters,
    };
  }

  // frota própria: gargalo real de motoboys
  if (!usesNetwork && toDispatch >= 3 && driversAvailable <= 1) {
    const need = Math.max(1, Math.ceil(toDispatch / 3) - driversAvailable);
    return {
      level: 'critical',
      emoji: '🔴',
      headline: 'Atenção',
      lines: [
        `${plural(toDispatch, 'pedido')} aguardando despacho e apenas ${motoboysDisponiveis(driversAvailable)}.`,
        late > 0 ? `${plural(late, 'pedido')} já ${late === 1 ? 'está atrasado' : 'estão atrasados'}.` : 'Ainda dá tempo de evitar atrasos.',
      ],
      action: `Coloque mais ${plural(need, 'entregador')} da sua equipe online.`,
      counters,
    };
  }

  if (late >= 2) {
    return {
      level: 'critical',
      emoji: '🔴',
      headline: 'Entregas atrasando',
      lines: [`${late} pedidos passaram do tempo esperado (${STAGE_SLA_MINUTES.total} min).`],
      action: 'Priorize o despacho dos pedidos mais antigos e avise os clientes.',
      counters,
    };
  }

  if (usesNetwork && searching >= 4) {
    return {
      level: 'warning',
      emoji: '🟡',
      headline: 'Buscando entregadores',
      lines: [`${plural(searching, 'pedido')} procurando entregador na rede Leeva.`],
      action: 'O despacho é automático — acompanhe pelo mapa.',
      counters,
    };
  }

  if (!usesNetwork && (toDispatch >= 3 || (toDispatch >= 1 && driversAvailable === 0))) {
    return {
      level: 'warning',
      emoji: '🟡',
      headline: 'Possível gargalo',
      lines: [
        `${plural(toDispatch, 'pedido')} para despachar` +
          (driversAvailable === 0
            ? ' e nenhum entregador da sua equipe online.'
            : `, ${plural(driversAvailable, 'entregador')} ${driversAvailable === 1 ? 'livre' : 'livres'}.`),
      ],
      action: driversAvailable === 0 ? 'Peça para a equipe ficar online.' : 'Aguarde o despacho automático.',
      counters,
    };
  }

  return {
    level: 'ok',
    emoji: '🟢',
    headline: 'Operação normal',
    lines: [
      orders.length
        ? `${plural(orders.length, 'pedido')} em andamento — ${inRoute} em rota, ${searching} buscando entregador.`
        : 'Nenhum pedido em andamento.',
      usesNetwork
        ? 'Despacho automático pela rede Leeva.'
        : `${motoboysDisponiveis(driversAvailable)} na sua equipe, ${driversOnDelivery} em entrega.`,
    ],
    action: null,
    counters,
  };
}
