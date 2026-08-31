/**
 * Alertas operacionais — regras determinísticas sobre o estado atual da
 * operação. Nada aleatório. Cada alerta tem uma `key` estável para não
 * duplicar; quando a condição some, o alerta é resolvido.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { STAGE_SLA_MINUTES } from '../constants';
import { plural, motoboysDisponiveis } from '../utils';

type DB = SupabaseClient<Database>;
type AlertRow = Database['public']['Tables']['alerts']['Insert'];

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

export type EvaluatedAlert = Omit<AlertRow, 'restaurant_id'>;

/** Não reavalia (escreve) com mais frequência que isto por restaurante. */
const EVAL_THROTTLE_MS = 12_000;

export async function evaluateAlerts(
  db: DB,
  restaurantId: string,
  opts: { force?: boolean } = {},
): Promise<{ active: EvaluatedAlert[]; resolvedKeys: string[]; throttled?: boolean }> {
  const now = Date.now();

  // throttle: se outro painel já reavaliou há pouco, só devolve o estado atual
  if (!opts.force) {
    const { data: rst } = await db
      .from('restaurants')
      .select('settings')
      .eq('id', restaurantId)
      .maybeSingle();
    const last = (rst?.settings as { alerts_evaluated_at?: string } | null)?.alerts_evaluated_at;
    if (last && now - new Date(last).getTime() < EVAL_THROTTLE_MS) {
      const current = await getActiveAlerts(db, restaurantId);
      return { active: current as EvaluatedAlert[], resolvedKeys: [], throttled: true };
    }
  }

  const { data: openOrders } = await db
    .from('orders')
    .select('id, order_number, status, created_at, ready_at, assigned_at, picked_up_at, motoboy_id')
    .eq('restaurant_id', restaurantId)
    .in('status', ['waiting_dispatch', 'preparing', 'ready', 'assigned', 'picked_up', 'in_route'])
    .order('created_at', { ascending: true })
    .limit(300);

  const { data: rst } = await db
    .from('restaurants')
    .select('fleet_mode')
    .eq('id', restaurantId)
    .maybeSingle();
  const ownFleetOnly = (rst?.fleet_mode ?? 'leeva') === 'own';

  const { data: motoboys } = await db
    .from('motoboys')
    .select('id, status, active')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .limit(500);

  const { data: recent } = await db
    .from('orders')
    .select('id, created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', new Date(now - 60 * 60000).toISOString())
    .limit(500);

  const { data: doneToday } = await db
    .from('orders')
    .select('id, created_at, delivered_at, status')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'delivered')
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .limit(2000);

  const orders = openOrders ?? [];
  const available = (motoboys ?? []).filter((m) => m.status === 'available').length;
  const waiting = orders.filter((o) => o.status === 'waiting_dispatch' || o.status === 'preparing' || o.status === 'ready').length;

  const active: EvaluatedAlert[] = [];

  // --- 1. atrasos por pedido ---
  for (const o of orders) {
    const total = minutesSince(o.created_at);
    if (total != null && total > STAGE_SLA_MINUTES.total && o.status !== 'in_route') {
      const late = Math.round(total - STAGE_SLA_MINUTES.total);
      active.push({
        type: 'delay',
        severity: late > 20 ? 'critical' : 'warning',
        key: `delay:${o.id}`,
        title: `Pedido #${o.order_number} atrasado`,
        message: `Pedido #${o.order_number} está ${late} min além do tempo esperado (${o.status}).`,
        data: { order_id: o.id, minutes_late: late },
      });
    }
  }

  // --- 2. falta de motoboy (só faz sentido para FROTA PRÓPRIA — na rede
  //        Leeva o alerta de "sem entregador" vem do motor de despacho) ---
  if (ownFleetOnly && waiting >= 3 && available <= 1) {
    active.push({
      type: 'no_driver',
      severity: waiting >= 6 ? 'critical' : 'warning',
      key: 'no_driver',
      title: 'Poucos entregadores para a fila',
      message: `${plural(waiting, 'pedido')} aguardando e apenas ${motoboysDisponiveis(available)} na sua equipe. Peça para mais entregadores ficarem online.`,
      data: { waiting, available },
    });
  }

  // --- 3. pico de demanda ---
  const lastHour = recent?.length ?? 0;
  const last30 = (recent ?? []).filter((o) => now - new Date(o.created_at).getTime() < 30 * 60000).length;
  if (last30 >= 5 && last30 > lastHour - last30) {
    active.push({
      type: 'demand_spike',
      severity: 'warning',
      key: 'demand_spike',
      title: 'Aumento de demanda',
      message: `${last30} pedidos nos últimos 30 min (contra ${lastHour - last30} nos 30 anteriores). Prepare a cozinha e os motoboys.`,
      data: { last30, prev30: lastHour - last30 },
    });
  }

  // --- 4. preparo longo ---
  const longPrep = orders.filter((o) => {
    const m = minutesSince(o.created_at);
    return (o.status === 'waiting_dispatch' || o.status === 'preparing') && m != null && m > STAGE_SLA_MINUTES.prep;
  });
  if (longPrep.length >= 2) {
    active.push({
      type: 'long_prep',
      severity: 'warning',
      key: 'long_prep',
      title: 'Cozinha acumulando',
      message: `${longPrep.length} pedidos há mais de ${STAGE_SLA_MINUTES.prep} min sem ficar prontos.`,
      data: { count: longPrep.length },
    });
  }

  // --- 5. operação normal (só quando não há alerta pior) ---
  if (active.length === 0) {
    const done = (doneToday ?? []).filter((o) => o.status === 'delivered');
    const onTime = done.filter((o) => {
      const m =
        o.delivered_at && o.created_at
          ? (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000
          : null;
      return m != null && m <= STAGE_SLA_MINUTES.total;
    }).length;
    const pct = done.length ? Math.round((onTime / done.length) * 100) : 100;
    active.push({
      type: 'normal',
      severity: 'ok',
      key: 'normal',
      title: 'Operação normal',
      message: done.length
        ? `${pct}% das ${done.length} entregas de hoje ficaram dentro do tempo esperado.`
        : 'Sem pendências. Nenhuma entrega concluída ainda hoje.',
      data: { on_time_pct: pct, delivered: done.length },
    });
  }

  // --- reconciliação com o banco ---
  const { data: current } = await db
    .from('alerts')
    .select('id, key')
    .eq('restaurant_id', restaurantId)
    .eq('active', true);

  const activeKeys = new Set(active.map((a) => a.key));
  const resolvedKeys = (current ?? []).filter((c) => !activeKeys.has(c.key)).map((c) => c.key);
  const nowIso = new Date().toISOString();

  // upsert de TODOS os ativos numa tacada só
  if (active.length) {
    await db.from('alerts').upsert(
      active.map((a) => ({
        ...a,
        restaurant_id: restaurantId,
        active: true,
        resolved_at: null,
        updated_at: nowIso,
      })),
      { onConflict: 'restaurant_id,key', ignoreDuplicates: false },
    );
  }

  if (resolvedKeys.length) {
    // alertas de atraso são por-pedido e transitórios → apaga ao resolver
    // (não deixa a tabela crescer para sempre). Os agregados ficam
    // desativados, para histórico.
    const transient = resolvedKeys.filter((k) => k.startsWith('delay:'));
    const aggregate = resolvedKeys.filter((k) => !k.startsWith('delay:'));
    if (transient.length)
      await db.from('alerts').delete().eq('restaurant_id', restaurantId).in('key', transient);
    if (aggregate.length)
      await db
        .from('alerts')
        .update({ active: false, resolved_at: nowIso })
        .eq('restaurant_id', restaurantId)
        .in('key', aggregate);
  }

  // marca quando reavaliamos (para o throttle)
  const { data: rst2 } = await db
    .from('restaurants')
    .select('settings')
    .eq('id', restaurantId)
    .maybeSingle();
  await db
    .from('restaurants')
    .update({
      settings: { ...((rst2?.settings as object) ?? {}), alerts_evaluated_at: nowIso },
    })
    .eq('id', restaurantId);

  return { active, resolvedKeys };
}

/** Leitura barata dos alertas ativos (para polls frequentes do painel). */
export async function getActiveAlerts(db: DB, restaurantId: string) {
  const { data } = await db
    .from('alerts')
    .select('key, type, severity, title, message, data, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('severity', { ascending: true });
  return data ?? [];
}
