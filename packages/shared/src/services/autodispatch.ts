/**
 * DESPACHO AUTOMÁTICO — o coração da Fase 3.
 *
 * O restaurante NÃO escolhe motoboy. O Leeva:
 *   1. identifica candidatos elegíveis (frota própria + rede, conforme o
 *      fleet_mode do restaurante);
 *   2. exclui offline / sem capacidade / fora do raio;
 *   3. pontua cada candidato (ETA à coleta, impacto na rota, carga,
 *      confiabilidade, histórico, avaliação) — pesos CONFIGURÁVEIS;
 *   4. envia a oferta automaticamente ao melhor;
 *   5. no timeout / recusa, tenta o próximo automaticamente;
 *   6. se ninguém aceita, marca 'failed' e cria alerta.
 *
 * Determinístico. Sem IA. Reaproveita geo/routing da Fase 2.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { LogisticsConfig } from '../types';
import { haversineKm, minutesForKm, isValidLatLng, type LatLng } from './geo';
import { getRoutingService } from './routing';
import { getPayoutPolicy, computeDriverPayout, computeLogisticsFinance } from './payout';
import { classifyOfferQuality } from './reputation';
import { sendPushToMotoboy } from './push';
import { planGroupForOrder, applyGroupPlan, dissolveGroup, type GroupPlan } from './grouping-dispatch';

type DB = SupabaseClient<Database>;

/** Pesos do score. Configuráveis via restaurants.logistics_config.dispatch_weights. */
export const DEFAULT_DISPATCH_WEIGHTS = {
  etaToPickup: 40,
  routeImpact: 20,
  load: 15,
  reliability: 10,
  history: 10,
  rating: 5,
};
export type DispatchWeights = typeof DEFAULT_DISPATCH_WEIGHTS;

export const DEFAULT_LOGISTICS_CONFIG: LogisticsConfig = {
  service_radius_km: 8,
  customer_fee: 9.5,
  free_delivery_min_order: null,
  min_order: 0,
  grouping_enabled: true,
  auto_dispatch_enabled: true,
  offer_timeout_seconds: 45,
  max_dispatch_attempts: 4,
};

export type ScoredCandidate = {
  motoboyId: string;
  name: string;
  fleet: 'own' | 'leeva';
  score: number;
  breakdown: Record<string, number>;
  distanceToPickupKm: number | null;
  etaToPickupMin: number | null;
  activeDeliveries: number;
  maxDeliveries: number;
  reliability: number;
  completionRate: number;
  rating: number;
  reasons: string[];
  blockers: string[];
};

// ---------------------------------------------------------------------------
// SCORING
// ---------------------------------------------------------------------------

export async function scoreCandidatesForOrder(
  db: DB,
  orderId: string,
  opts: { excludeMotoboyIds?: string[]; tickLoad?: Map<string, number> } = {},
): Promise<{
  candidates: ScoredCandidate[];
  order: { id: string; restaurantId: string; orderNumber: number | null };
  note?: string;
}> {
  const { data: order } = await db
    .from('orders')
    .select('id, order_number, restaurant_id, latitude, longitude, status, motoboy_id, group_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) throw new Error('pedido não encontrado');

  const { data: rst } = await db
    .from('restaurants')
    .select('latitude, longitude, fleet_mode, logistics_config')
    .eq('id', order.restaurant_id)
    .maybeSingle();

  const cfg = { ...DEFAULT_LOGISTICS_CONFIG, ...((rst?.logistics_config as Partial<LogisticsConfig>) ?? {}) };
  const weights: DispatchWeights = {
    ...DEFAULT_DISPATCH_WEIGHTS,
    ...(((rst?.logistics_config as { dispatch_weights?: Partial<DispatchWeights> })?.dispatch_weights) ?? {}),
  };
  const fleetMode = rst?.fleet_mode ?? 'leeva';

  const pickup: LatLng | null = isValidLatLng(rst?.latitude, rst?.longitude)
    ? { latitude: rst!.latitude as number, longitude: rst!.longitude as number }
    : null;
  const dropoff: LatLng | null = isValidLatLng(order.latitude, order.longitude)
    ? { latitude: order.latitude as number, longitude: order.longitude as number }
    : null;

  // --- pool de candidatos ---
  const wantOwn = fleetMode === 'own' || fleetMode === 'hybrid';
  const wantLeeva = fleetMode === 'leeva' || fleetMode === 'hybrid';

  // só motoboy APROVADO e com os termos vigentes aceitos entra no pool
  const { data: terms } = await db
    .from('terms_versions')
    .select('version')
    .eq('active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeTermsVersion = terms?.version ?? 0;

  let q = db
    .from('motoboys')
    .select(
      'id, full_name, fleet, restaurant_id, status, active, blocked, current_latitude, current_longitude, location_updated_at, max_concurrent_deliveries, rating, deliveries_total, deliveries_completed, deliveries_late, avg_delay_min',
    )
    .eq('active', true)
    .eq('blocked', false)
    .eq('approval_status', 'approved')
    .gte('terms_accepted_version', activeTermsVersion)
    .limit(200);

  const orParts: string[] = [];
  if (wantOwn) orParts.push(`and(restaurant_id.eq.${order.restaurant_id},fleet.eq.own)`);
  if (wantLeeva) orParts.push('fleet.eq.leeva');
  if (orParts.length) q = q.or(orParts.join(','));

  const { data: motoboys } = await q;

  // entregas ativas de cada motoboy
  const motoboyIds = (motoboys ?? []).map((m) => m.id);
  const { data: activeOrders } = motoboyIds.length
    ? await db
        .from('orders')
        .select('id, motoboy_id, latitude, longitude, status')
        .in('motoboy_id', motoboyIds)
        .in('status', ['assigned', 'picked_up', 'in_route'])
    : { data: [] };

  const byDriver = new Map<string, { count: number; drops: LatLng[] }>();
  for (const o of activeOrders ?? []) {
    if (!o.motoboy_id || o.id === orderId) continue;
    const e = byDriver.get(o.motoboy_id) ?? { count: 0, drops: [] };
    e.count += 1;
    if (isValidLatLng(o.latitude, o.longitude))
      e.drops.push({ latitude: o.latitude as number, longitude: o.longitude as number });
    byDriver.set(o.motoboy_id, e);
  }

  const routing = getRoutingService();
  const exclude = new Set(opts.excludeMotoboyIds ?? []);
  const candidates: ScoredCandidate[] = [];

  for (const m of motoboys ?? []) {
    if (exclude.has(m.id)) continue;
    const load = byDriver.get(m.id) ?? { count: 0, drops: [] };
    const max = m.max_concurrent_deliveries ?? 3;
    const tickExtra = opts.tickLoad?.get(m.id) ?? 0; // ofertas já feitas neste tick
    const effectiveLoad = load.count + tickExtra;

    const reasons: string[] = [];
    const blockers: string[] = [];
    if (m.status === 'offline') blockers.push('offline');
    if (effectiveLoad >= max) blockers.push(`no limite (${effectiveLoad}/${max})`);

    const here: LatLng | null = isValidLatLng(m.current_latitude, m.current_longitude)
      ? { latitude: m.current_latitude as number, longitude: m.current_longitude as number }
      : null;

    // distância / ETA à coleta
    let distanceToPickupKm: number | null = null;
    let etaToPickupMin: number | null = null;
    if (here && pickup) {
      const leg = await routing.leg(here, pickup);
      distanceToPickupKm = leg?.distanceKm ?? haversineKm(here, pickup);
      etaToPickupMin = leg?.durationMin ?? (distanceToPickupKm != null ? minutesForKm(distanceToPickupKm * 1.3) : null);
    }
    if (distanceToPickupKm != null && distanceToPickupKm > cfg.service_radius_km * 2) {
      blockers.push(`fora do raio (${distanceToPickupKm.toFixed(1)} km)`);
    }

    // impacto na rota: quão perto o novo destino fica das entregas atuais
    let routeImpactScore = 0.6; // neutro
    if (dropoff && load.drops.length) {
      const minDist = Math.min(...load.drops.map((d) => haversineKm(d, dropoff) ?? 99));
      routeImpactScore = minDist <= 1.5 ? 1 : minDist <= 3 ? 0.75 : minDist <= 6 ? 0.4 : 0.15;
      if (minDist <= 1.5) reasons.push(`entrega a ${minDist.toFixed(1)} km de uma já em rota — agrupável`);
    } else if (load.count === 0) {
      routeImpactScore = 0.8; // sem rota atual = zero desvio
    }

    // componentes 0..1
    const etaScore =
      etaToPickupMin == null ? 0.45 : Math.max(0, 1 - etaToPickupMin / 25); // 0 min -> 1 ; 25 min -> 0
    const loadScore = max > 0 ? Math.max(0, 1 - effectiveLoad / max) : 0;
    const completionRate = m.deliveries_total > 0 ? m.deliveries_completed / m.deliveries_total : 1;
    const reliability = m.deliveries_total >= 5 ? completionRate : 0.85; // pouca amostra = neutro-alto
    const lateRate = m.deliveries_completed > 0 ? m.deliveries_late / m.deliveries_completed : 0;
    const historyScore = Math.max(0, 1 - lateRate) * (m.avg_delay_min > 0 ? Math.max(0.3, 1 - m.avg_delay_min / 20) : 1);
    const ratingScore = Math.min(1, Math.max(0, (Number(m.rating) - 3) / 2)); // 3..5 -> 0..1

    const breakdown: Record<string, number> = {
      etaToPickup: round(etaScore * weights.etaToPickup),
      routeImpact: round(routeImpactScore * weights.routeImpact),
      load: round(loadScore * weights.load),
      reliability: round(reliability * weights.reliability),
      history: round(historyScore * weights.history),
      rating: round(ratingScore * weights.rating),
    };
    let score = round(Object.values(breakdown).reduce((s, v) => s + v, 0));
    if (blockers.length) score = Math.min(score, 8);

    if (m.status === 'available') reasons.push('disponível');
    else if (m.status === 'on_delivery' && effectiveLoad < max)
      reasons.push(`em entrega, com folga (${effectiveLoad}/${max})`);
    if (etaToPickupMin != null) reasons.push(`~${Math.round(etaToPickupMin)} min até a coleta`);
    if (m.deliveries_completed >= 10) reasons.push(`${Math.round(completionRate * 100)}% de conclusão`);

    candidates.push({
      motoboyId: m.id,
      name: m.full_name,
      fleet: m.fleet as 'own' | 'leeva',
      score,
      breakdown,
      distanceToPickupKm,
      etaToPickupMin: etaToPickupMin != null ? Math.round(etaToPickupMin) : null,
      activeDeliveries: load.count,
      maxDeliveries: max,
      reliability: round(reliability),
      completionRate: round(completionRate),
      rating: Number(m.rating),
      reasons,
      blockers,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  let note: string | undefined;
  const eligible = candidates.filter((c) => c.blockers.length === 0);
  if (!eligible.length) {
    note = candidates.length
      ? 'Nenhum entregador disponível no momento (todos offline, no limite ou fora do raio).'
      : 'Nenhum entregador na frota / rede para este restaurante.';
  } else if (!pickup) {
    note = 'Defina a localização do restaurante para o cálculo de proximidade ficar preciso.';
  }

  return {
    candidates,
    order: { id: order.id, restaurantId: order.restaurant_id, orderNumber: order.order_number },
    note,
  };
}

// ---------------------------------------------------------------------------
// OFERTA / ACEITE / RECUSA / EXPIRAÇÃO
// ---------------------------------------------------------------------------

export type DispatchTickResult = {
  offered: number;
  expired: number;
  failed: number;
  details: string[];
};

/** Um "tick" do motor: expira ofertas vencidas, oferta pedidos pendentes,
 *  marca como falha os que esgotaram as tentativas. Idempotente e seguro
 *  para rodar de vários lugares (cron + realtime trigger). */
export async function runDispatchTick(db: DB, restaurantId?: string): Promise<DispatchTickResult> {
  const res: DispatchTickResult = { offered: 0, expired: 0, failed: 0, details: [] };

  // 1. expira ofertas vencidas
  const nowIso = new Date().toISOString();
  let expQ = db
    .from('dispatch_attempts')
    .select('id, order_id, restaurant_id, motoboy_id, group_order_ids')
    .is('responded_at', null)
    .lt('expires_at', nowIso);
  if (restaurantId) expQ = expQ.eq('restaurant_id', restaurantId);
  const { data: stale } = await expQ;

  for (const a of stale ?? []) {
    const { data: closed } = await db
      .from('dispatch_attempts')
      .update({ responded_at: nowIso, outcome: 'timeout', reason: 'sem resposta no tempo' })
      .eq('id', a.id)
      .is('responded_at', null)
      .select('id');
    if (closed?.length) {
      res.expired++;
      if (a.group_order_ids?.length) {
        // rota agrupada sem resposta → dissolve; cada pedido volta ao individual
        const { data: lead } = await db.from('orders').select('group_id').eq('id', a.order_id).maybeSingle();
        if (lead?.group_id) await dissolveGroup(db, lead.group_id, { reason: 'sem resposta no tempo' });
      } else {
        await db
          .from('orders')
          .update({ dispatch_state: 'searching' })
          .eq('id', a.order_id)
          .eq('dispatch_state', 'offered');
      }
    }
  }

  // 2. pedidos que precisam de despacho
  let pendQ = db
    .from('orders')
    .select('id, restaurant_id, dispatch_attempts, group_id, group_lead')
    .in('status', ['waiting_dispatch', 'preparing', 'ready'])
    .is('motoboy_id', null)
    .in('dispatch_state', ['none', 'searching'])
    .order('created_at', { ascending: true })
    .limit(50);
  if (restaurantId) pendQ = pendQ.eq('restaurant_id', restaurantId);
  const { data: pending } = await pendQ;

  // carga acumulada dentro deste tick (balanceamento greedy)
  const tickLoad = new Map<string, number>();
  // pedidos absorvidos por uma rota agrupada NESTE tick (não ofertar de novo)
  const groupedThisTick = new Set<string>();

  for (const o of pending ?? []) {
    // pedido já agrupado que NÃO é o lead: quem despacha é a oferta do lead
    if (o.group_id && !o.group_lead) continue;
    if (groupedThisTick.has(o.id)) continue;

    // config do restaurante
    const { data: rst } = await db
      .from('restaurants')
      .select('logistics_config')
      .eq('id', o.restaurant_id)
      .maybeSingle();
    const cfg = { ...DEFAULT_LOGISTICS_CONFIG, ...((rst?.logistics_config as Partial<LogisticsConfig>) ?? {}) };
    if (!cfg.auto_dispatch_enabled) continue;

    if ((o.dispatch_attempts ?? 0) >= cfg.max_dispatch_attempts) {
      const { data: f } = await db
        .from('orders')
        .update({ dispatch_state: 'failed' })
        .eq('id', o.id)
        .neq('dispatch_state', 'failed')
        .select('id');
      if (f?.length) {
        res.failed++;
        await createNoDriverAlert(db, o.restaurant_id, o.id);
      }
      continue;
    }

    // motoboys já recusados/timeout neste pedido
    const { data: prev } = await db
      .from('dispatch_attempts')
      .select('motoboy_id')
      .eq('order_id', o.id);
    const exclude = [...new Set((prev ?? []).map((p) => p.motoboy_id))];

    const { candidates, note } = await scoreCandidatesForOrder(db, o.id, {
      excludeMotoboyIds: exclude,
      tickLoad,
    });
    const best = candidates.find((c) => c.blockers.length === 0);
    if (!best) {
      res.details.push(`#${o.id.slice(0, 6)}: ${note ?? 'sem candidato'}`);
      // mantém 'searching'; próxima tentativa contará como attempt
      await db
        .from('orders')
        .update({ dispatch_state: 'searching', dispatch_attempts: (o.dispatch_attempts ?? 0) + 1 })
        .eq('id', o.id);
      if ((o.dispatch_attempts ?? 0) + 1 >= cfg.max_dispatch_attempts) {
        const { data: f } = await db
          .from('orders')
          .update({ dispatch_state: 'failed' })
          .eq('id', o.id)
          .select('id');
        if (f?.length) {
          res.failed++;
          await createNoDriverAlert(db, o.restaurant_id, o.id);
        }
      }
      continue;
    }

    // --- classifica a QUALIDADE da oferta (entregador + entrega + momento) ---
    // recusar oferta "poor" NUNCA penaliza; só excellent/good contam p/ aceitação
    const quality = await classifyOfferForCandidate(db, o.id, o.restaurant_id, best);

    // --- AGRUPAMENTO: tenta montar uma rota com pedidos vizinhos ---
    // (só se este pedido ainda não está em grupo)
    let groupPlan: GroupPlan | null = null;
    if (!o.group_id) {
      try {
        const plan = await planGroupForOrder(db, o.id);
        if (plan && plan.stops.length >= 2) {
          await applyGroupPlan(db, plan);
          groupPlan = plan;
          for (const id of plan.orderIds) groupedThisTick.add(id);
          // as outras paradas saem do despacho individual
          await db
            .from('orders')
            .update({ dispatch_state: 'offered' })
            .in('id', plan.orderIds.filter((id) => id !== o.id));
        }
      } catch (e) {
        res.details.push(`#${o.id.slice(0, 6)}: agrupamento falhou (${(e as Error).message})`);
      }
    }

    const offerPayout = groupPlan ? groupPlan.totalPayout : quality.payout;
    const offerTotalKm = groupPlan
      ? groupPlan.totalDistanceKm
      : quality.distanceTotalKm != null
        ? round(quality.distanceTotalKm)
        : null;

    // cria a oferta (unique index garante 1 aberta por pedido)
    const expiresAt = new Date(Date.now() + cfg.offer_timeout_seconds * 1000).toISOString();
    const { error: offErr } = await db.from('dispatch_attempts').insert({
      restaurant_id: o.restaurant_id,
      order_id: o.id,
      motoboy_id: best.motoboyId,
      attempt_number: (o.dispatch_attempts ?? 0) + 1,
      score: best.score,
      score_breakdown: best.breakdown,
      expires_at: expiresAt,
      quality: quality.quality,
      quality_score: quality.score,
      quality_factors: quality.factors,
      counts_for_acceptance: quality.countsForAcceptance,
      payout_estimate: offerPayout,
      distance_pickup_km: best.distanceToPickupKm != null ? round(best.distanceToPickupKm) : null,
      distance_total_km: offerTotalKm,
      group_order_ids: groupPlan ? groupPlan.orderIds : null,
      group_plan: groupPlan ? (groupPlan.stops as unknown as Database['public']['Tables']['dispatch_attempts']['Insert']['group_plan']) : null,
    });
    if (offErr) {
      if (offErr.code === '23505') continue; // já há oferta aberta
      res.details.push(`#${o.id.slice(0, 6)}: erro ao ofertar`);
      continue;
    }

    await db
      .from('orders')
      .update({ dispatch_state: 'offered', dispatch_attempts: (o.dispatch_attempts ?? 0) + 1 })
      .eq('id', o.id);
    tickLoad.set(best.motoboyId, (tickLoad.get(best.motoboyId) ?? 0) + 1);
    res.offered++;
    const groupTag = groupPlan ? ` [rota ${groupPlan.stops.length} paradas]` : '';
    res.details.push(`#${o.id.slice(0, 6)} → ${best.name} (${best.score} pts)${groupTag}`);

    // notifica o motoboy — "você é o melhor candidato" (oferta prioritária),
    // mas ele PODE recusar; se a oferta for ruim, a recusa não prejudica.
    const priorityLine =
      quality.quality === 'poor'
        ? 'Oferta pouco vantajosa — recusar não afeta sua reputação.'
        : 'Você é o melhor candidato para esta entrega.';
    const offerTitle = groupPlan
      ? `Nova rota — ${groupPlan.stops.length} entregas`
      : 'Nova entrega disponível';
    await db.from('notifications').insert({
      restaurant_id: o.restaurant_id,
      order_id: o.id,
      channel: 'in_app',
      recipient_type: 'motoboy',
      recipient: best.motoboyId,
      template: 'motoboy.offer',
      title: offerTitle,
      body: `${priorityLine} Aceite antes que expire.`,
      status: 'sent',
      sent_at: new Date().toISOString(),
      data: { order_id: o.id, quality: quality.quality, grouped: !!groupPlan },
    });

    // Web Push (se o motoboy autorizou) — chega mesmo com o app fechado.
    const { data: pushM } = await db
      .from('motoboys')
      .select('push_enabled')
      .eq('id', best.motoboyId)
      .maybeSingle();
    if (pushM?.push_enabled) {
      const payoutTxt =
        offerPayout != null ? ` — você recebe R$ ${Number(offerPayout).toFixed(2).replace('.', ',')}` : '';
      void sendPushToMotoboy(db, best.motoboyId, {
        title: offerTitle,
        body: `${priorityLine}${payoutTxt}. Aceite antes que expire.`,
        url: '/status',
        tag: 'offer',
        urgent: true,
        data: { order_id: o.id },
      }).catch(() => {});
    }
  }

  return res;
}

/** Classifica a qualidade da oferta para um candidato concreto. */
async function classifyOfferForCandidate(
  db: DB,
  orderId: string,
  restaurantId: string,
  best: ScoredCandidate,
): Promise<{
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  score: number;
  factors: Record<string, number>;
  countsForAcceptance: boolean;
  payout: number;
  distanceTotalKm: number | null;
}> {
  const { data: order } = await db
    .from('orders')
    .select('latitude, longitude, group_id, driver_payout, route_distance_km')
    .eq('id', orderId)
    .maybeSingle();
  const { data: rst } = await db
    .from('restaurants')
    .select('latitude, longitude')
    .eq('id', restaurantId)
    .maybeSingle();

  const pickup: LatLng | null = isValidLatLng(rst?.latitude, rst?.longitude)
    ? { latitude: rst!.latitude as number, longitude: rst!.longitude as number }
    : null;
  const dropoff: LatLng | null = isValidLatLng(order?.latitude, order?.longitude)
    ? { latitude: order!.latitude as number, longitude: order!.longitude as number }
    : null;

  let distanceDropoffKm: number | null =
    order?.route_distance_km != null ? Number(order.route_distance_km) : null;
  let etaDropoffMin: number | null =
    distanceDropoffKm != null ? minutesForKm(distanceDropoffKm) : null;
  if (distanceDropoffKm == null && pickup && dropoff) {
    const leg = await getRoutingService().leg(pickup, dropoff);
    distanceDropoffKm = leg?.distanceKm ?? haversineKm(pickup, dropoff);
    etaDropoffMin = leg?.durationMin ?? (distanceDropoffKm != null ? minutesForKm(distanceDropoffKm) : null);
  }

  // FONTE ÚNICA: a remuneração já foi calculada e gravada na criação do pedido.
  // A oferta mostra EXATAMENTE esse valor — nunca recalcula.
  let payout = order?.driver_payout != null ? Number(order.driver_payout) : null;
  if (payout == null) {
    let groupSize = 1;
    if (order?.group_id) {
      const { count } = await db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', order.group_id);
      groupSize = Math.max(1, count ?? 1);
    }
    const policy = await getPayoutPolicy(db, restaurantId);
    payout = computeDriverPayout(policy, { distanceKm: distanceDropoffKm, groupSize }).total;
  }

  const etaTotalMin =
    best.etaToPickupMin != null || etaDropoffMin != null
      ? (best.etaToPickupMin ?? 0) + (etaDropoffMin ?? 0)
      : null;
  const routeFits = (best.breakdown.routeImpact ?? 0) >= 15;

  const q = classifyOfferQuality({
    payout,
    distancePickupKm: best.distanceToPickupKm,
    distanceDropoffKm,
    etaTotalMin,
    routeFits,
  });

  const distanceTotalKm =
    best.distanceToPickupKm != null || distanceDropoffKm != null
      ? (best.distanceToPickupKm ?? 0) + (distanceDropoffKm ?? 0)
      : null;

  return {
    quality: q.quality,
    score: q.score,
    factors: q.factors,
    countsForAcceptance: q.countsForAcceptance,
    payout,
    distanceTotalKm,
  };
}

/**
 * Wrapper de produção do tick: LEASE com TTL (não processa em duplicidade),
 * log em `dispatch_runs` e captura de erro. Use este no cron e no nudge.
 */
export async function dispatchTick(
  db: DB,
  opts: { source?: string; restaurantId?: string; leaseSeconds?: number } = {},
): Promise<DispatchTickResult & { skipped?: boolean; runId?: string }> {
  const source = opts.source ?? 'cron';
  // lease só para o loop global (sem restaurantId). Nudges por restaurante
  // são naturalmente disjuntos e podem correr em paralelo.
  let leased = true;
  if (!opts.restaurantId) {
    try {
      const { data } = await db.rpc('acquire_dispatch_lease', { ttl_seconds: opts.leaseSeconds ?? 20 });
      leased = data === true;
    } catch {
      leased = true; // se o RPC falhar, segue (runDispatchTick é idempotente)
    }
    if (!leased) {
      await db
        .from('dispatch_runs')
        .insert({ source, skipped: true, finished_at: new Date().toISOString(), duration_ms: 0 });
      return { offered: 0, expired: 0, failed: 0, details: [], skipped: true };
    }
  }

  const started = Date.now();
  const { data: run } = await db
    .from('dispatch_runs')
    .insert({ source, restaurant_id: opts.restaurantId ?? null })
    .select('id')
    .maybeSingle();

  try {
    const result = await runDispatchTick(db, opts.restaurantId);
    await db
      .from('dispatch_runs')
      .update({
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
        offered: result.offered,
        expired: result.expired,
        failed: result.failed,
      })
      .eq('id', run?.id ?? '');
    return { ...result, runId: run?.id };
  } catch (e) {
    await db
      .from('dispatch_runs')
      .update({
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
        error: e instanceof Error ? e.message.slice(0, 400) : String(e),
      })
      .eq('id', run?.id ?? '');
    throw e;
  }
  // sem release explícito: o LEASE (TTL ~20s) garante no máximo uma execução
  // global por janela, evitando sobreposição de dois ticks do cron.
}

async function createNoDriverAlert(db: DB, restaurantId: string, orderId: string) {
  await db.from('alerts').upsert(
    {
      restaurant_id: restaurantId,
      type: 'no_driver',
      severity: 'critical',
      key: `no_driver:${orderId}`,
      title: 'Sem entregador disponível',
      message: 'Não encontramos entregador para um pedido. A rede está sem capacidade para a demanda atual.',
      data: { order_id: orderId },
      active: true,
      resolved_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'restaurant_id,key' },
  );
}

/** Motoboy aceita a oferta. CAS na oferta aberta + no motoboy_id do pedido. */
export async function acceptOffer(db: DB, offerId: string, motoboyId: string) {
  const nowIso = new Date().toISOString();
  const { data: closed } = await db
    .from('dispatch_attempts')
    .update({ responded_at: nowIso, outcome: 'accepted' })
    .eq('id', offerId)
    .eq('motoboy_id', motoboyId)
    .is('responded_at', null)
    .select('order_id, restaurant_id, group_order_ids');
  if (!closed?.length) return { ok: false as const, error: 'oferta expirada ou já respondida' };

  const { order_id, restaurant_id, group_order_ids } = closed[0]!;
  const orderIds = group_order_ids?.length ? group_order_ids : [order_id];

  const { data: assigned } = await db
    .from('orders')
    .update({ motoboy_id: motoboyId, status: 'assigned', dispatch_state: 'assigned' })
    .in('id', orderIds)
    .is('motoboy_id', null)
    .select('id');
  if (!assigned?.length) {
    // o pedido foi para outro no meio do caminho — reverte a oferta
    await db.from('dispatch_attempts').update({ outcome: 'cancelled', reason: 'pedido já atribuído' }).eq('id', offerId);
    return { ok: false as const, error: 'este pedido já foi atribuído' };
  }

  await db.from('motoboys').update({ status: 'on_delivery' }).eq('id', motoboyId);
  for (const oid of assigned.map((a) => a.id)) {
    await finalizeLogisticsForOrder(db, oid, restaurant_id);
    await db.from('order_events').insert({
      restaurant_id,
      order_id: oid,
      type: 'delivery.accepted',
      actor_type: 'motoboy',
      actor_id: motoboyId,
      data: { via: 'auto_dispatch', grouped: orderIds.length > 1 },
    });
  }

  return { ok: true as const, orderId: order_id };
}

/** Motoboy recusa. A oferta fecha; o loop tenta o próximo. */
export async function declineOffer(db: DB, offerId: string, motoboyId: string, reason?: string) {
  const { data: closed } = await db
    .from('dispatch_attempts')
    .update({ responded_at: new Date().toISOString(), outcome: 'declined', reason: reason ?? null })
    .eq('id', offerId)
    .eq('motoboy_id', motoboyId)
    .is('responded_at', null)
    .select('order_id, group_order_ids');
  if (!closed?.length) return { ok: false as const, error: 'oferta já respondida' };

  // oferta agrupada recusada → DISSOLVE o grupo: cada pedido volta ao
  // despacho individual (decisão em DECISOES-NOTURNAS.md).
  if (closed[0]!.group_order_ids?.length) {
    const { data: leadOrder } = await db
      .from('orders')
      .select('group_id')
      .eq('id', closed[0]!.order_id)
      .maybeSingle();
    if (leadOrder?.group_id) {
      await dissolveGroup(db, leadOrder.group_id, { reason: 'motoboy recusou a rota' });
    }
    return { ok: true as const };
  }

  await db
    .from('orders')
    .update({ dispatch_state: 'searching' })
    .eq('id', closed[0]!.order_id)
    .eq('dispatch_state', 'offered');
  return { ok: true as const };
}

/**
 * Grava rota/taxa/remuneração da entrega (uma vez).
 *
 * FONTE ÚNICA DA REMUNERAÇÃO: se a entrega veio de uma oferta aceita, o
 * `driver_payout` é EXATAMENTE o `payout_estimate` que o motoboy viu na
 * oferta — nunca recalculado. Recalcular em outro momento (com outra
 * medição de distância) causava divergência entre o valor ofertado e o
 * valor pago. Só recalcula quando não há oferta (atribuição manual).
 */
export async function finalizeLogisticsForOrder(db: DB, orderId: string, restaurantId: string) {
  const { data: order } = await db
    .from('orders')
    .select('id, latitude, longitude, delivery_fee, customer_fee, group_id, driver_payout, order_amount')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.driver_payout != null) return; // já finalizado

  // valor autoritativo: a oferta aceita (o que o motoboy realmente viu)
  const { data: acceptedOffer } = await db
    .from('dispatch_attempts')
    .select('payout_estimate')
    .eq('order_id', orderId)
    .eq('outcome', 'accepted')
    .not('payout_estimate', 'is', null)
    .order('responded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: rst } = await db
    .from('restaurants')
    .select('latitude, longitude, logistics_config')
    .eq('id', restaurantId)
    .maybeSingle();
  const cfg = { ...DEFAULT_LOGISTICS_CONFIG, ...((rst?.logistics_config as Partial<LogisticsConfig>) ?? {}) };

  const pickup: LatLng | null = isValidLatLng(rst?.latitude, rst?.longitude)
    ? { latitude: rst!.latitude as number, longitude: rst!.longitude as number }
    : null;
  const dropoff: LatLng | null = isValidLatLng(order.latitude, order.longitude)
    ? { latitude: order.latitude as number, longitude: order.longitude as number }
    : null;

  let distanceKm: number | null = null;
  let durationMin: number | null = null;
  if (pickup && dropoff) {
    const leg = await getRoutingService().leg(pickup, dropoff);
    distanceKm = leg?.distanceKm ?? haversineKm(pickup, dropoff);
    durationMin = leg?.durationMin ?? (distanceKm != null ? minutesForKm(distanceKm) : null);
  }

  let groupSize = 1;
  if (order.group_id) {
    const { count } = await db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', order.group_id);
    groupSize = Math.max(1, count ?? 1);
  }

  const policy = await getPayoutPolicy(db, restaurantId);
  const payoutTotal =
    acceptedOffer?.payout_estimate != null
      ? Number(acceptedOffer.payout_estimate) // valor da oferta aceita — nunca recalcula
      : computeDriverPayout(policy, { distanceKm, groupSize }).total; // fallback: atribuição manual

  // A taxa da LOGÍSTICA cobrada do restaurante é a configurada em
  // logistics_config (não a delivery_fee da venda, que é dinheiro do
  // restaurante). Um valor explícito em order.customer_fee tem prioridade.
  const customerFee =
    order.customer_fee != null && Number(order.customer_fee) > 0
      ? Number(order.customer_fee)
      : cfg.customer_fee;

  const fin = computeLogisticsFinance({ customerFee, driverPayout: payoutTotal });

  await db
    .from('orders')
    .update({
      route_distance_km: distanceKm != null ? Math.round(distanceKm * 100) / 100 : null,
      route_duration_min: durationMin != null ? Math.round(durationMin) : null,
      customer_fee: fin.leevaFee,
      leeva_fee: fin.leevaFee,
      driver_payout: fin.driverPayout,
    })
    .eq('id', orderId);
}

const round = (n: number) => Math.round(n * 100) / 100;
