/**
 * A rota do motoboy: as entregas ativas dele, numa ordem.
 *
 * - O Leeva sugere a ordem (route-optimizer: prazo prometido + distância) e
 *   grava em `orders.route_position` — assim ela não fica pulando a cada
 *   atualização da tela.
 * - O motoboy manda: pode reordenar (`reorderMotoboyRoute`) e a ordem dele
 *   vale daí pra frente.
 * - Entrega nova que chega com a rota em andamento entra no fim, já
 *   otimizada a partir da última parada.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { LogisticsConfig } from '../types';
import { isValidLatLng, type LatLng } from './geo';
import { optimizeStopOrder, evaluateRoute, googleMapsRouteUrl, type RouteStopInput } from './route-optimizer';
import { advanceOrderStatus } from './orders';

type DB = SupabaseClient<Database>;

export const ACTIVE_ROUTE_STATUSES = ['preparing', 'ready', 'assigned', 'picked_up', 'in_route'] as const;

const DEFAULT_PROMISE_MIN = 50;

type Row = {
  id: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  assigned_at: string | null;
  route_position: number | null;
  group_sequence: number | null;
  restaurant_id: string;
};

export type MotoboyRoute = {
  /** ids na ordem da rota */
  orderIds: string[];
  /** prazo e chegada estimada por pedido (epoch ms) */
  stops: { orderId: string; deadline: number | null; eta: number | null; late: boolean }[];
  totalKm: number;
  lateMinutes: number;
  /** Google Maps com todas as paradas ainda não entregues, na ordem */
  navigationUrl: string | null;
};

async function loadActive(db: DB, motoboyId: string): Promise<Row[]> {
  const { data, error } = await db
    .from('orders')
    .select('id, status, latitude, longitude, created_at, assigned_at, route_position, group_sequence, restaurant_id')
    .eq('motoboy_id', motoboyId)
    .in('status', [...ACTIVE_ROUTE_STATUSES])
    .limit(30);
  if (!error) return (data ?? []) as Row[];
  // banco sem a migration 0049 (coluna route_position): segue funcionando na
  // ordem de atribuição, sem gravar ordem — o app do motoboy não pode parar.
  const { data: legacy } = await db
    .from('orders')
    .select('id, status, latitude, longitude, created_at, assigned_at, group_sequence, restaurant_id')
    .eq('motoboy_id', motoboyId)
    .in('status', [...ACTIVE_ROUTE_STATUSES])
    .order('assigned_at', { ascending: true })
    .limit(30);
  return (legacy ?? []).map((r, i) => ({ ...r, route_position: i + 1 })) as Row[];
}

async function promiseMinutesByRestaurant(db: DB, ids: string[]) {
  const map = new Map<string, { promise: number; origin: LatLng | null }>();
  if (!ids.length) return map;
  const { data } = await db.from('restaurants').select('id, latitude, longitude, logistics_config').in('id', ids);
  for (const r of data ?? []) {
    const cfg = (r.logistics_config as Partial<LogisticsConfig> | null) ?? {};
    map.set(r.id, {
      promise: cfg.delivery_promise_minutes ?? DEFAULT_PROMISE_MIN,
      origin: isValidLatLng(r.latitude, r.longitude) ? { latitude: r.latitude as number, longitude: r.longitude as number } : null,
    });
  }
  return map;
}

const toStop = (r: Row, promise: number): RouteStopInput | null =>
  isValidLatLng(r.latitude, r.longitude)
    ? {
        id: r.id,
        point: { latitude: Number(r.latitude), longitude: Number(r.longitude) },
        deadline: new Date(r.created_at).getTime() + promise * 60_000,
      }
    : null;

/**
 * Ordem atual da rota. Pedidos ainda sem posição são encaixados no fim
 * (otimizados) e a posição é gravada.
 */
export async function getMotoboyRoute(
  db: DB,
  motoboyId: string,
  opts: { current?: LatLng | null } = {},
): Promise<MotoboyRoute> {
  const rows = await loadActive(db, motoboyId);
  const rsts = await promiseMinutesByRestaurant(db, [...new Set(rows.map((r) => r.restaurant_id))]);
  const promiseOf = (r: Row) => rsts.get(r.restaurant_id)?.promise ?? DEFAULT_PROMISE_MIN;

  // em rota agora sempre vem primeiro; depois a ordem gravada
  const positioned = rows
    .filter((r) => r.route_position != null)
    .sort(
      (a, b) =>
        Number(b.status === 'in_route') - Number(a.status === 'in_route') ||
        (a.route_position as number) - (b.route_position as number),
    );
  const loose = rows.filter((r) => r.route_position == null);

  let appended: Row[] = [];
  if (loose.length) {
    const last = positioned[positioned.length - 1];
    const origin: LatLng | null =
      (last && isValidLatLng(last.latitude, last.longitude)
        ? { latitude: Number(last.latitude), longitude: Number(last.longitude) }
        : null) ??
      rsts.get(loose[0]!.restaurant_id)?.origin ??
      opts.current ??
      null;
    const withPoint = loose.map((r) => ({ r, s: toStop(r, promiseOf(r)) }));
    const optimizable = withPoint.filter((x) => x.s).map((x) => x.s!) as RouteStopInput[];
    const order = origin ? optimizeStopOrder(origin, optimizable).order : optimizable.map((s) => s.id);
    const byId = new Map(loose.map((r) => [r.id, r]));
    appended = [
      ...order.map((id) => byId.get(id)!),
      // sem coordenada: no fim, pela ordem de atribuição
      ...withPoint.filter((x) => !x.s).map((x) => x.r).sort((a, b) => (a.assigned_at ?? '').localeCompare(b.assigned_at ?? '')),
    ];
    let pos = positioned.reduce((m, r) => Math.max(m, r.route_position as number), 0);
    for (const r of appended) {
      pos += 1;
      r.route_position = pos;
      await db.from('orders').update({ route_position: pos }).eq('id', r.id).is('route_position', null);
    }
  }

  const ordered = [...positioned, ...appended];
  return describe(ordered, rsts, promiseOf, opts.current ?? null);
}

function describe(
  ordered: Row[],
  rsts: Map<string, { promise: number; origin: LatLng | null }>,
  promiseOf: (r: Row) => number,
  current: LatLng | null,
): MotoboyRoute {
  const origin = current ?? (ordered[0] ? rsts.get(ordered[0].restaurant_id)?.origin ?? null : null);
  const stops = ordered.map((r) => toStop(r, promiseOf(r)));
  const valid = stops.filter(Boolean) as RouteStopInput[];
  const ev = origin && valid.length ? evaluateRoute(origin, valid) : null;
  const etaById = new Map(ev ? ev.order.map((id, i) => [id, ev.arrivals[i]!]) : []);
  return {
    orderIds: ordered.map((r) => r.id),
    stops: ordered.map((r, i) => {
      const deadline = stops[i]?.deadline ?? null;
      const eta = etaById.get(r.id) ?? null;
      return { orderId: r.id, deadline, eta, late: deadline != null && eta != null && eta > deadline };
    }),
    totalKm: ev?.totalKm ?? 0,
    lateMinutes: ev?.lateMinutes ?? 0,
    navigationUrl: googleMapsRouteUrl(valid.map((s) => s.point)),
  };
}

/** O motoboy escolhe a ordem. Ids que não são dele são ignorados; os que faltarem vão pro fim. */
export async function reorderMotoboyRoute(
  db: DB,
  motoboyId: string,
  orderIds: string[],
): Promise<{ ok: true; route: MotoboyRoute } | { ok: false; error: string }> {
  const rows = await loadActive(db, motoboyId);
  const mine = new Set(rows.map((r) => r.id));
  const wanted = orderIds.filter((id, i) => mine.has(id) && orderIds.indexOf(id) === i);
  if (!wanted.length) return { ok: false, error: 'nenhuma entrega sua nessa lista' };
  const rest = rows
    .filter((r) => !wanted.includes(r.id))
    .sort((a, b) => (a.route_position ?? 1e6) - (b.route_position ?? 1e6))
    .map((r) => r.id);
  const final = [...wanted, ...rest];
  for (let i = 0; i < final.length; i++) {
    await db.from('orders').update({ route_position: i + 1 }).eq('id', final[i]!).eq('motoboy_id', motoboyId);
  }
  return { ok: true, route: await getMotoboyRoute(db, motoboyId) };
}

/** Volta pra ordem sugerida pelo Leeva (refaz a otimização de tudo que ainda não saiu pra entrega). */
export async function resetMotoboyRoute(db: DB, motoboyId: string): Promise<MotoboyRoute> {
  const rows = await loadActive(db, motoboyId);
  const ids = rows.filter((r) => r.status !== 'in_route').map((r) => r.id);
  if (ids.length) await db.from('orders').update({ route_position: null }).in('id', ids).eq('motoboy_id', motoboyId);
  return getMotoboyRoute(db, motoboyId);
}

/**
 * "Retirei todos": marca como retirados, de uma vez, todos os pedidos da rota
 * que estão esperando coleta no mesmo restaurante — o motoboy pega tudo numa
 * ida só em vez de confirmar um por um.
 */
export async function pickUpAllForMotoboy(
  db: DB,
  motoboyId: string,
  restaurantId?: string,
): Promise<{ ok: true; count: number; errors: string[] }> {
  const rows = (await loadActive(db, motoboyId)).filter(
    (r) => r.status === 'assigned' && (!restaurantId || r.restaurant_id === restaurantId),
  );
  const errors: string[] = [];
  let count = 0;
  for (const r of rows) {
    const res = await advanceOrderStatus(db, r.id, 'picked_up', { actorType: 'motoboy', actorId: motoboyId });
    if (res.ok) count += 1;
    else errors.push(res.error);
  }
  return { ok: true, count, errors };
}

/** Ordena uma lista qualquer de linhas de pedido pela rota. */
export function sortByRoute<T extends { id: string }>(rows: T[], route: Pick<MotoboyRoute, 'orderIds'>): T[] {
  const idx = new Map(route.orderIds.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => (idx.get(a.id) ?? 1e6) - (idx.get(b.id) ?? 1e6));
}
