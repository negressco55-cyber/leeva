/**
 * Motor de despacho — recommendDriver(orderId).
 *
 * Determinístico. Analisa os motoboys candidatos e gera uma pontuação
 * 0–100 para cada um, com a explicação baseada nos MESMOS dados usados
 * no cálculo (nada de texto genérico).
 *
 * Não decide sozinho: devolve a recomendação; o restaurante aceita ou troca.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { haversineKm, minutesForKm, isValidLatLng, type LatLng } from './geo';

type DB = SupabaseClient<Database>;

export type DriverCandidate = {
  motoboyId: string;
  name: string;
  status: Database['public']['Enums']['motoboy_status'];
  score: number;
  activeDeliveries: number;
  maxDeliveries: number;
  distanceToPickupKm: number | null;
  etaToPickupMin: number | null;
  hasNearbyDelivery: boolean;
  nearbyDeliveryDistanceKm: number | null;
  reasons: string[];
  blockers: string[];
};

export type DispatchRecommendation = {
  orderId: string;
  orderNumber: number | null;
  recommended: DriverCandidate | null;
  candidates: DriverCandidate[];
  usedEstimates: boolean;
  generatedAt: string;
  note?: string;
};

const WEIGHTS = {
  availability: 35, // livre agora vale mais que ocupado com folga
  proximity: 30, // perto do ponto de coleta
  load: 20, // pouca carga atual
  grouping: 15, // já tem entrega para a mesma região
};

const NEARBY_KM = 1.5; // raio para considerar "entrega próxima" (agrupável)

export async function recommendDriver(db: DB, orderId: string): Promise<DispatchRecommendation> {
  const { data: order } = await db
    .from('orders')
    .select('id, order_number, restaurant_id, latitude, longitude, status, customer_address, motoboy_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) throw new Error('Pedido não encontrado');
  if (['delivered', 'cancelled'].includes(order.status))
    throw new Error('Pedido já finalizado — não há o que despachar');

  const { data: restaurant } = await db
    .from('restaurants')
    .select('latitude, longitude')
    .eq('id', order.restaurant_id)
    .maybeSingle();

  const pickup: LatLng | null = isValidLatLng(restaurant?.latitude, restaurant?.longitude)
    ? { latitude: restaurant!.latitude as number, longitude: restaurant!.longitude as number }
    : null;
  const dropoff: LatLng | null = isValidLatLng(order.latitude, order.longitude)
    ? { latitude: order.latitude as number, longitude: order.longitude as number }
    : null;

  const { data: motoboys } = await db
    .from('motoboys')
    .select(
      'id, full_name, status, active, current_latitude, current_longitude, max_concurrent_deliveries',
    )
    .eq('restaurant_id', order.restaurant_id)
    .eq('active', true);

  // entregas ativas de cada motoboy (para carga + agrupamento)
  const { data: activeOrders } = await db
    .from('orders')
    .select('id, motoboy_id, latitude, longitude, status')
    .eq('restaurant_id', order.restaurant_id)
    .in('status', ['assigned', 'picked_up', 'in_route'])
    .not('motoboy_id', 'is', null);

  const byDriver = new Map<string, { count: number; drops: LatLng[] }>();
  for (const o of activeOrders ?? []) {
    if (!o.motoboy_id || o.id === orderId) continue;
    const entry = byDriver.get(o.motoboy_id) ?? { count: 0, drops: [] };
    entry.count += 1;
    if (o.latitude != null && o.longitude != null) {
      entry.drops.push({ latitude: o.latitude, longitude: o.longitude });
    }
    byDriver.set(o.motoboy_id, entry);
  }

  let usedEstimates = false;
  const candidates: DriverCandidate[] = [];

  for (const m of motoboys ?? []) {
    const load = byDriver.get(m.id) ?? { count: 0, drops: [] };
    const max = m.max_concurrent_deliveries ?? 3;
    const reasons: string[] = [];
    const blockers: string[] = [];

    if (m.status === 'offline') blockers.push('Está offline');
    if (load.count >= max) blockers.push(`Já está com ${load.count} entregas (limite ${max})`);

    const here: LatLng | null = isValidLatLng(m.current_latitude, m.current_longitude)
      ? { latitude: m.current_latitude as number, longitude: m.current_longitude as number }
      : null;

    // --- proximidade até a coleta ---
    let distanceToPickupKm: number | null = null;
    let etaToPickupMin: number | null = null;
    if (here && pickup) {
      distanceToPickupKm = haversineKm(here, pickup);
      if (distanceToPickupKm != null) {
        etaToPickupMin = Math.round(minutesForKm(distanceToPickupKm * 1.3));
        usedEstimates = true;
      }
    }

    // --- agrupamento: já tem uma entrega perto do destino deste pedido? ---
    let hasNearbyDelivery = false;
    let nearbyDeliveryDistanceKm: number | null = null;
    if (dropoff && load.drops.length) {
      for (const d of load.drops) {
        const dist = haversineKm(d, dropoff);
        if (dist != null && dist <= NEARBY_KM) {
          hasNearbyDelivery = true;
          nearbyDeliveryDistanceKm =
            nearbyDeliveryDistanceKm == null ? dist : Math.min(nearbyDeliveryDistanceKm, dist);
        }
      }
    }

    // --- pontuação por componente (0..1) ---
    const availabilityScore = m.status === 'available' ? 1 : m.status === 'on_delivery' && load.count < max ? 0.55 : 0;

    let proximityScore = 0.5; // neutro quando não há coordenadas
    if (distanceToPickupKm != null) {
      // 0 km -> 1.0 ; 5 km -> ~0 (decaimento linear)
      proximityScore = Math.max(0, 1 - distanceToPickupKm / 5);
    }

    const loadScore = max > 0 ? Math.max(0, 1 - load.count / max) : 0;

    const groupingScore = hasNearbyDelivery ? 1 : 0;

    let score =
      availabilityScore * WEIGHTS.availability +
      proximityScore * WEIGHTS.proximity +
      loadScore * WEIGHTS.load +
      groupingScore * WEIGHTS.grouping;

    if (blockers.length) score = Math.min(score, 15);
    score = Math.round(score);

    // --- explicação (só afirma o que os dados sustentam) ---
    if (m.status === 'available') reasons.push('Está disponível');
    else if (m.status === 'on_delivery' && load.count < max)
      reasons.push(`Está em entrega mas tem folga (${load.count}/${max})`);

    if (distanceToPickupKm != null) {
      reasons.push(
        `Está a ${distanceToPickupKm.toFixed(1)} km da coleta` +
          (etaToPickupMin != null ? ` (~${etaToPickupMin} min)` : ''),
      );
    }
    if (load.count === 0) reasons.push('Sem nenhuma entrega no momento');
    if (hasNearbyDelivery && nearbyDeliveryDistanceKm != null) {
      reasons.push(
        `Tem uma entrega a ${nearbyDeliveryDistanceKm.toFixed(1)} km deste destino — dá para agrupar`,
      );
    }

    candidates.push({
      motoboyId: m.id,
      name: m.full_name,
      status: m.status,
      score,
      activeDeliveries: load.count,
      maxDeliveries: max,
      distanceToPickupKm,
      etaToPickupMin,
      hasNearbyDelivery,
      nearbyDeliveryDistanceKm,
      reasons,
      blockers,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const recommended = candidates.find((c) => c.blockers.length === 0) ?? null;

  let note: string | undefined;
  if (!recommended) {
    note =
      candidates.length === 0
        ? 'Nenhum motoboy cadastrado e ativo neste restaurante.'
        : 'Nenhum motoboy disponível no momento (todos offline ou no limite de entregas).';
  } else if (!pickup) {
    note = 'Defina a localização do restaurante nas configurações para o cálculo de distância ficar preciso.';
  } else if (!candidates.some((c) => c.distanceToPickupKm != null)) {
    note = 'Nenhum motoboy enviou localização ainda — a proximidade não pôde ser considerada.';
  }

  return {
    orderId,
    orderNumber: order.order_number,
    recommended,
    candidates,
    usedEstimates,
    generatedAt: new Date().toISOString(),
    note,
  };
}

/** Texto curto para o card de recomendação. */
export function explainRecommendation(c: DriverCandidate): string {
  return `${c.name} é o melhor candidato (${c.score} pts):\n` + c.reasons.map((r) => `• ${r}`).join('\n');
}
