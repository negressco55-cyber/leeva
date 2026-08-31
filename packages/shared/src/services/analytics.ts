/**
 * Indicadores — todos os números vêm do banco. Nada fictício.
 * Período: today | yesterday | 7d | 30d.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { haversineKm } from './geo';
import { regionFromAddress } from './geo';
import { STAGE_SLA_MINUTES } from '../constants';

type DB = SupabaseClient<Database>;
export type Period = 'today' | 'yesterday' | '7d' | '30d';

export function periodRange(period: Period): { from: string; to: string; label: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'today':
      return { from: startOfToday.toISOString(), to: now.toISOString(), label: 'Hoje' };
    case 'yesterday': {
      const y = new Date(startOfToday);
      y.setDate(y.getDate() - 1);
      return { from: y.toISOString(), to: startOfToday.toISOString(), label: 'Ontem' };
    }
    case '7d': {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - 6);
      return { from: d.toISOString(), to: now.toISOString(), label: 'Últimos 7 dias' };
    }
    case '30d': {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - 29);
      return { from: d.toISOString(), to: now.toISOString(), label: 'Últimos 30 dias' };
    }
  }
}

const minutesBetween = (a: string | null, b: string | null) =>
  a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 60000 : null;

/**
 * Teto de linhas por consulta de indicador. Acima disso (restaurantes muito
 * grandes num período longo) os números viram estimativa sobre a amostra
 * mais recente — ver `truncated` no retorno de getIndicators. Para volumes
 * assim o certo é agregação em SQL / tabela materializada (próximo passo).
 */
const MAX_ANALYTICS_ROWS = 20000;

type OrderMetricRow = {
  id: string;
  status: string;
  source: string;
  motoboy_id: string | null;
  region: string | null;
  customer_address: string;
  created_at: string;
  delivered_at: string | null;
  cancelled_at: string | null;
  delivery_fee: number | null;
  latitude: number | null;
  longitude: number | null;
};

async function fetchOrderRows(db: DB, restaurantId: string, period: Period) {
  const { from, to } = periodRange(period);
  const { data } = await db
    .from('orders')
    .select(
      'id, status, source, motoboy_id, region, customer_address, created_at, delivered_at, cancelled_at, delivery_fee, latitude, longitude',
    )
    .eq('restaurant_id', restaurantId)
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: false })
    .limit(MAX_ANALYTICS_ROWS + 1);
  const rows = (data ?? []) as OrderMetricRow[];
  return { rows: rows.slice(0, MAX_ANALYTICS_ROWS), truncated: rows.length > MAX_ANALYTICS_ROWS };
}

async function originOf(db: DB, restaurantId: string) {
  const { data } = await db
    .from('restaurants')
    .select('latitude, longitude')
    .eq('id', restaurantId)
    .maybeSingle();
  return data?.latitude != null && data?.longitude != null
    ? { latitude: data.latitude, longitude: data.longitude }
    : null;
}

/**
 * Todos os indicadores numa passada só: busca o conjunto de pedidos UMA vez
 * e calcula overview + por motoboy + por região. Substitui as 3 consultas
 * separadas da página de indicadores.
 */
export async function getIndicators(db: DB, restaurantId: string, period: Period) {
  const [{ rows, truncated }, origin, motoboys] = await Promise.all([
    fetchOrderRows(db, restaurantId, period),
    originOf(db, restaurantId),
    db.from('motoboys').select('id, full_name').eq('restaurant_id', restaurantId).limit(500),
  ]);
  const { label } = periodRange(period);
  return {
    truncated,
    overview: computeOverview(rows, origin, label),
    drivers: computeDrivers(rows, motoboys.data ?? [], origin),
    regions: computeRegions(rows),
  };
}

export type OverviewMetrics = {
  period: string;
  delivered: number;
  cancelled: number;
  inProgress: number;
  avgDeliveryMin: number | null;
  avgDistanceKm: number | null;
  avgCost: number | null;
  lateRate: number | null;
  cancelRate: number | null;
  bySource: { source: string; count: number }[];
};

export async function getOverview(db: DB, restaurantId: string, period: Period): Promise<OverviewMetrics> {
  const [{ rows }, origin] = await Promise.all([
    fetchOrderRows(db, restaurantId, period),
    originOf(db, restaurantId),
  ]);
  return computeOverview(rows, origin, periodRange(period).label);
}

type Origin = { latitude: number; longitude: number } | null;

function computeOverview(all: OrderMetricRow[], origin: Origin, label: string): OverviewMetrics {
  const delivered = all.filter((o) => o.status === 'delivered');
  const cancelled = all.filter((o) => o.status === 'cancelled');
  const inProgress = all.filter(
    (o) => !['delivered', 'cancelled'].includes(o.status),
  ).length;

  const deliveryTimes = delivered
    .map((o) => minutesBetween(o.created_at, o.delivered_at))
    .filter((n): n is number => n != null);
  const avgDeliveryMin = deliveryTimes.length
    ? round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
    : null;

  const distances = origin
    ? delivered
        .map((o) =>
          o.latitude != null && o.longitude != null
            ? haversineKm(origin, { latitude: o.latitude, longitude: o.longitude })
            : null,
        )
        .filter((n): n is number => n != null)
    : [];
  const avgDistanceKm = distances.length
    ? round(distances.reduce((a, b) => a + b, 0) / distances.length, 1)
    : null;

  const fees = delivered.map((o) => Number(o.delivery_fee ?? 0));
  const avgCost = fees.length ? round(fees.reduce((a, b) => a + b, 0) / fees.length, 2) : null;

  const late = delivered.filter((o) => {
    const m = minutesBetween(o.created_at, o.delivered_at);
    return m != null && m > STAGE_SLA_MINUTES.total;
  }).length;
  const lateRate = delivered.length ? round((late / delivered.length) * 100) : null;

  const closed = delivered.length + cancelled.length;
  const cancelRate = closed ? round((cancelled.length / closed) * 100) : null;

  const bySourceMap = new Map<string, number>();
  for (const o of all) bySourceMap.set(o.source, (bySourceMap.get(o.source) ?? 0) + 1);

  return {
    period: label,
    delivered: delivered.length,
    cancelled: cancelled.length,
    inProgress,
    avgDeliveryMin,
    avgDistanceKm,
    avgCost,
    lateRate,
    cancelRate,
    bySource: [...bySourceMap.entries()].map(([source, count]) => ({ source, count })),
  };
}

export type DriverMetrics = {
  motoboyId: string;
  name: string;
  deliveries: number;
  revenue: number;
  avgTimeMin: number | null;
  distanceKm: number | null;
  completionRate: number | null;
};

export async function getDriverMetrics(
  db: DB,
  restaurantId: string,
  period: Period,
): Promise<DriverMetrics[]> {
  const [{ rows }, origin, motoboys] = await Promise.all([
    fetchOrderRows(db, restaurantId, period),
    originOf(db, restaurantId),
    db.from('motoboys').select('id, full_name').eq('restaurant_id', restaurantId).limit(500),
  ]);
  return computeDrivers(rows, motoboys.data ?? [], origin);
}

function computeDrivers(
  orders: OrderMetricRow[],
  motoboys: { id: string; full_name: string }[],
  origin: Origin,
): DriverMetrics[] {
  return motoboys
    .map((m) => {
      const mine = orders.filter((o) => o.motoboy_id === m.id);
      const done = mine.filter((o) => o.status === 'delivered');
      const times = done
        .map((o) => minutesBetween(o.created_at, o.delivered_at))
        .filter((n): n is number => n != null);
      const dists = origin
        ? done
            .map((o) =>
              o.latitude != null && o.longitude != null
                ? haversineKm(origin, { latitude: o.latitude, longitude: o.longitude })
                : null,
            )
            .filter((n): n is number => n != null)
        : [];
      const assigned = mine.filter((o) => ['delivered', 'cancelled'].includes(o.status)).length;
      return {
        motoboyId: m.id,
        name: m.full_name,
        deliveries: done.length,
        revenue: round(done.reduce((s, o) => s + Number(o.delivery_fee ?? 0), 0), 2),
        avgTimeMin: times.length ? round(times.reduce((a, b) => a + b, 0) / times.length) : null,
        distanceKm: dists.length ? round(dists.reduce((a, b) => a + b, 0), 1) : null,
        completionRate: assigned ? round((done.length / assigned) * 100) : null,
      };
    })
    .filter((d) => d.deliveries > 0 || d.completionRate != null)
    .sort((a, b) => b.deliveries - a.deliveries);
}

export type RegionMetrics = {
  region: string;
  deliveries: number;
  avgTimeMin: number | null;
  lateRate: number | null;
};

export async function getRegionMetrics(
  db: DB,
  restaurantId: string,
  period: Period,
): Promise<RegionMetrics[]> {
  const { rows } = await fetchOrderRows(db, restaurantId, period);
  return computeRegions(rows);
}

function computeRegions(orders: OrderMetricRow[]): RegionMetrics[] {
  const map = new Map<string, { total: number; times: number[]; late: number; done: number }>();
  for (const o of orders) {
    const region = o.region || regionFromAddress(o.customer_address) || 'Sem região';
    const e = map.get(region) ?? { total: 0, times: [], late: 0, done: 0 };
    e.total += 1;
    if (o.status === 'delivered') {
      e.done += 1;
      const m = minutesBetween(o.created_at, o.delivered_at);
      if (m != null) {
        e.times.push(m);
        if (m > STAGE_SLA_MINUTES.total) e.late += 1;
      }
    }
    map.set(region, e);
  }

  return [...map.entries()]
    .map(([region, e]) => ({
      region,
      deliveries: e.done,
      avgTimeMin: e.times.length ? round(e.times.reduce((a, b) => a + b, 0) / e.times.length) : null,
      lateRate: e.done ? round((e.late / e.done) * 100) : null,
    }))
    .filter((r) => r.deliveries > 0)
    .sort((a, b) => b.deliveries - a.deliveries);
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
