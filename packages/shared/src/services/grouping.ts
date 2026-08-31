/**
 * Agrupamento de entregas — primeira versão funcional.
 *
 * Estratégia (simples e evolutiva): clusteriza os pedidos abertos por
 * proximidade geográfica do destino usando um agrupamento guloso por raio.
 * Não é um solver de VRP — é uma sugestão útil que o restaurante confirma.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { haversineKm, centroid, minutesForKm, isValidLatLng, type LatLng } from './geo';
import { getRoutingService } from './routing';

type DB = SupabaseClient<Database>;

export type GroupableOrder = {
  id: string;
  orderNumber: number | null;
  customerName: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type DeliveryGroup = {
  orders: GroupableOrder[];
  center: LatLng;
  spreadKm: number; // maior distância entre dois destinos do grupo
  routeDistanceKm: number; // rota estimada saindo da coleta
  routeDurationMin: number;
  isEstimate: boolean;
};

export type GroupingSuggestion = {
  restaurantId: string;
  groups: DeliveryGroup[];
  generatedAt: string;
};

const DEFAULT_RADIUS_KM = 1.2;
const MAX_GROUP_SIZE = 4; // um motoboy não carrega mais que isso de uma vez
const MAX_ORDERS_CONSIDERED = 60; // performance: só analisa a fila mais antiga

export async function suggestGroups(
  db: DB,
  restaurantId: string,
  opts: { radiusKm?: number; statuses?: Database['public']['Enums']['order_status'][] } = {},
): Promise<GroupingSuggestion> {
  const radiusKm = opts.radiusKm ?? DEFAULT_RADIUS_KM;
  const statuses = opts.statuses ?? ['waiting_dispatch', 'preparing', 'ready'];

  const { data: rows } = await db
    .from('orders')
    .select('id, order_number, customer_name, customer_address, latitude, longitude, group_id')
    .eq('restaurant_id', restaurantId)
    .in('status', statuses)
    .is('group_id', null)
    .is('motoboy_id', null)
    .order('created_at', { ascending: true })
    .limit(MAX_ORDERS_CONSIDERED);

  const orders: GroupableOrder[] = (rows ?? [])
    .filter((o) => isValidLatLng(o.latitude, o.longitude))
    .map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      address: o.customer_address,
      latitude: o.latitude as number,
      longitude: o.longitude as number,
    }));

  const { data: restaurant } = await db
    .from('restaurants')
    .select('latitude, longitude')
    .eq('id', restaurantId)
    .single();
  const origin: LatLng | null =
    restaurant?.latitude != null && restaurant?.longitude != null
      ? { latitude: restaurant.latitude, longitude: restaurant.longitude }
      : null;

  // --- clustering guloso ---
  // O candidato precisa estar dentro do raio de TODOS os membros do grupo
  // (não só de um) — isso evita "correntes" de pedidos em sentidos opostos.
  // O grupo também tem tamanho máximo (capacidade do motoboy).
  const remaining = [...orders];
  const rawGroups: GroupableOrder[][] = [];
  while (remaining.length) {
    const seed = remaining.shift()!;
    const group = [seed];
    for (let i = remaining.length - 1; i >= 0 && group.length < MAX_GROUP_SIZE; i--) {
      const cand = remaining[i]!;
      const nearAll = group.every((g) => (haversineKm(g, cand) ?? Infinity) <= radiusKm * 2);
      if (nearAll) {
        group.push(cand);
        remaining.splice(i, 1);
      }
    }
    if (group.length >= 2) rawGroups.push(group);
  }

  const routing = getRoutingService();
  const groups: DeliveryGroup[] = [];
  for (const g of rawGroups) {
    const center = centroid(g)!;
    let spreadKm = 0;
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++)
        spreadKm = Math.max(spreadKm, haversineKm(g[i]!, g[j]!) ?? 0);

    // rota: coleta -> destinos na ordem por distância crescente do centro
    const ordered = [...g].sort(
      (a, b) => (haversineKm(center, a) ?? 0) - (haversineKm(center, b) ?? 0),
    );
    const points: LatLng[] = origin ? [origin, ...ordered] : ordered;
    const plan = await routing.route(points);

    groups.push({
      orders: ordered,
      center,
      spreadKm,
      routeDistanceKm: plan?.totalDistanceKm ?? spreadKm * 1.3,
      routeDurationMin: plan?.totalDurationMin ?? minutesForKm(spreadKm * 1.3),
      isEstimate: plan?.isEstimate ?? true,
    });
  }

  groups.sort((a, b) => b.orders.length - a.orders.length);
  return { restaurantId, groups, generatedAt: new Date().toISOString() };
}
