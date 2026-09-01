/**
 * Agrupamento de entregas no DESPACHO (Fase 5 Bloco C).
 *
 * Diferente de `grouping.ts` (que sugere grupos para o restaurante confirmar),
 * aqui o próprio motor de despacho monta uma ROTA com 2+ pedidos do mesmo
 * restaurante e a oferta inteira vai para um único motoboy.
 *
 * Preço (config em payout_policies.config, editável no admin):
 *   parada 1 (lead) = tabela cheia  → computeDriverPayout(policy, {distanceKm: rest→p1})
 *   parada k > 1     = max(group_stop_min, kmIncremental(p[k-1] → p[k]) × per_km)
 *   total do motoboy = soma das paradas
 *   restaurante paga por pedido = payout daquela parada + margem do plano
 *
 * Recusa da oferta agrupada → dissolveGroup(): cada pedido volta ao
 * despacho individual. Simples e previsível (ver DECISOES-NOTURNAS.md).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { haversineKm, isValidLatLng, type LatLng } from './geo';
import { getRoutingService } from './routing';
import { getPayoutPolicy, computeDriverPayout, getPlanMargin } from './payout';
import { adjustCredit } from './credits';

type DB = SupabaseClient<Database>;

const round = (n: number) => Math.round(n * 100) / 100;

export type GroupStop = {
  orderId: string;
  seq: number; // 1 = lead
  address: string;
  region: string | null;
  lat: number;
  lng: number;
  legKm: number; // distância da parada anterior (ou do restaurante, p/ a 1ª) até esta
  payout: number; // valor do motoboy nesta parada
  total: number; // cobrado do restaurante por este pedido (payout + margem)
};

export type GroupPlan = {
  restaurantId: string;
  orderIds: string[];
  stops: GroupStop[];
  totalPayout: number;
  totalDistanceKm: number;
  margin: number;
};

/**
 * Tenta montar uma rota agrupada tendo `leadOrderId` como âncora.
 * Retorna null se não há pedido compatível o suficiente (grupo de 1).
 */
export async function planGroupForOrder(db: DB, leadOrderId: string): Promise<GroupPlan | null> {
  const { data: lead } = await db
    .from('orders')
    .select('id, restaurant_id, latitude, longitude, customer_address, region, status, payment_method, payment_status, group_id, motoboy_id')
    .eq('id', leadOrderId)
    .maybeSingle();
  if (!lead || lead.group_id || lead.motoboy_id) return null;
  if (!isValidLatLng(lead.latitude, lead.longitude)) return null;

  const policy = await getPayoutPolicy(db, lead.restaurant_id);
  const maxStops = Math.max(1, Math.floor(policy.group_max_stops ?? 3));
  if (maxStops < 2) return null;
  const radiusKm = policy.group_radius_km ?? 1.5;
  const stopMin = policy.group_stop_min ?? 3.5;

  const { data: rst } = await db
    .from('restaurants')
    .select('latitude, longitude')
    .eq('id', lead.restaurant_id)
    .maybeSingle();
  if (!isValidLatLng(rst?.latitude, rst?.longitude)) return null;
  const origin: LatLng = { latitude: rst!.latitude as number, longitude: rst!.longitude as number };

  // candidatos: mesmo restaurante, ainda sem motoboy, sem grupo, prontos p/ despacho,
  // mesma condição de pagamento do lead (não misturar "receber na entrega" com pago online)
  const { data: siblings } = await db
    .from('orders')
    .select('id, latitude, longitude, customer_address, region, created_at')
    .eq('restaurant_id', lead.restaurant_id)
    .neq('id', lead.id)
    .is('motoboy_id', null)
    .is('group_id', null)
    .in('status', ['waiting_dispatch', 'preparing', 'ready'])
    .in('dispatch_state', ['none', 'searching', 'offered'])
    .eq('payment_method', lead.payment_method)
    .eq('payment_status', lead.payment_status)
    .order('created_at', { ascending: true })
    .limit(20);

  const leadPoint: LatLng = { latitude: lead.latitude as number, longitude: lead.longitude as number };
  const pool = (siblings ?? [])
    .filter((s) => isValidLatLng(s.latitude, s.longitude))
    .map((s) => ({
      orderId: s.id,
      address: s.customer_address,
      region: s.region,
      point: { latitude: s.latitude as number, longitude: s.longitude as number } as LatLng,
    }))
    // só quem está dentro do raio do destino do lead
    .filter((s) => (haversineKm(leadPoint, s.point) ?? Infinity) <= radiusKm)
    .sort((a, b) => (haversineKm(leadPoint, a.point) ?? 0) - (haversineKm(leadPoint, b.point) ?? 0));

  if (!pool.length) return null;

  // sequência: restaurante → lead → vizinho mais próximo → ... (nearest-neighbor)
  const chosen = [{ orderId: lead.id, address: lead.customer_address, region: lead.region, point: leadPoint }];
  const rest = [...pool];
  while (chosen.length < maxStops && rest.length) {
    const last = chosen[chosen.length - 1]!.point;
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const d = haversineKm(last, rest[i]!.point) ?? Infinity;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    // a próxima parada também precisa estar dentro do raio da parada anterior
    if (bd > radiusKm) break;
    chosen.push(rest[bi]!);
    rest.splice(bi, 1);
  }
  if (chosen.length < 2) return null;

  const routing = getRoutingService();
  const margin = round(await getPlanMargin(db, lead.restaurant_id));

  const stops: GroupStop[] = [];
  let prev: LatLng = origin;
  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i]!;
    const leg = await routing.leg(prev, c.point);
    const legKm = round(leg?.distanceKm ?? (haversineKm(prev, c.point) ?? 0) * 1.3);
    let payout: number;
    if (i === 0) {
      payout = computeDriverPayout(policy, { distanceKm: legKm, groupSize: 1 }).total;
    } else {
      payout = round(Math.max(stopMin, legKm * policy.per_km));
    }
    stops.push({
      orderId: c.orderId,
      seq: i + 1,
      address: c.address,
      region: c.region,
      lat: c.point.latitude,
      lng: c.point.longitude,
      legKm,
      payout,
      total: round(payout + margin),
    });
    prev = c.point;
  }

  const totalPayout = round(stops.reduce((s, x) => s + x.payout, 0));
  const totalDistanceKm = round(stops.reduce((s, x) => s + x.legKm, 0));

  return {
    restaurantId: lead.restaurant_id,
    orderIds: stops.map((s) => s.orderId),
    stops,
    totalPayout,
    totalDistanceKm,
    margin,
  };
}

/**
 * Grava o plano: marca group_id/sequence, reescreve payout e cobrança de
 * cada pedido, e ajusta o crédito do restaurante pela diferença (o valor
 * cheio foi debitado na criação; agrupar quase sempre reduz).
 */
export async function applyGroupPlan(db: DB, plan: GroupPlan): Promise<{ ok: boolean; groupId: string }> {
  const groupId = crypto.randomUUID();

  for (const stop of plan.stops) {
    const { data: before } = await db
      .from('orders')
      .select('customer_fee, leeva_fee, driver_payout')
      .eq('id', stop.orderId)
      .maybeSingle();
    const prevTotal = before?.customer_fee != null ? Number(before.customer_fee) : null;

    await db
      .from('orders')
      .update({
        group_id: groupId,
        group_sequence: stop.seq,
        group_lead: stop.seq === 1,
        driver_payout: stop.payout,
        customer_fee: stop.total,
        leeva_fee: stop.total,
      })
      .eq('id', stop.orderId);

    // ajuste de crédito pela diferença (positivo = devolve ao restaurante)
    if (prevTotal != null) {
      const delta = round(prevTotal - stop.total);
      if (Math.abs(delta) >= 0.01) {
        try {
          await adjustCredit(
            db,
            plan.restaurantId,
            delta,
            `Ajuste por agrupamento de entrega (pedido ${stop.orderId.slice(0, 8)})`,
          );
        } catch {
          /* ajuste de crédito nunca bloqueia o despacho */
        }
      }
    }
  }
  return { ok: true, groupId };
}

/**
 * Desfaz o grupo: limpa as colunas, recalcula a cobrança individual de cada
 * pedido (valor cheio) e ajusta o crédito de volta. Deixa os pedidos em
 * 'searching' para o próximo tick do despacho individual.
 */
export async function dissolveGroup(
  db: DB,
  groupId: string,
  opts: { reason?: string } = {},
): Promise<{ dissolved: number }> {
  const { data: members } = await db
    .from('orders')
    .select('id, restaurant_id, customer_fee, latitude, longitude')
    .eq('group_id', groupId);
  if (!members?.length) return { dissolved: 0 };

  const { finalizeDeliveryCharge } = await import('./payout');

  for (const m of members) {
    const prevTotal = m.customer_fee != null ? Number(m.customer_fee) : null;

    // zera para o finalize recalcular do zero
    await db
      .from('orders')
      .update({
        group_id: null,
        group_sequence: null,
        group_lead: false,
        driver_payout: null,
        customer_fee: null,
        leeva_fee: null,
        dispatch_state: 'searching',
      })
      .eq('id', m.id);

    const charge = await finalizeDeliveryCharge(db, m.id, m.restaurant_id);
    const newTotal = charge?.total ?? null;

    if (prevTotal != null && newTotal != null) {
      const delta = round(prevTotal - newTotal); // negativo = volta a cobrar a diferença
      if (Math.abs(delta) >= 0.01) {
        try {
          await adjustCredit(
            db,
            m.restaurant_id,
            delta,
            `Ajuste por desfazer agrupamento${opts.reason ? ` (${opts.reason})` : ''} (pedido ${m.id.slice(0, 8)})`,
          );
        } catch {
          /* não bloqueia */
        }
      }
    }
  }
  return { dissolved: members.length };
}
