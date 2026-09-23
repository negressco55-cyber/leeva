/**
 * Preferência do restaurante sobre um motoboy: favorito (prioridade no
 * despacho) ou bloqueado (nunca recebe oferta desse restaurante).
 * Independe do bloqueio geral do admin (motoboys.blocked) — é por restaurante.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type DB = SupabaseClient<Database>;

export type DriverPrefKind = 'favorite' | 'blocked';

export type KnownDriver = {
  motoboyId: string;
  name: string;
  deliveriesForRestaurant: number;
  lastDeliveryAt: string | null;
  pref: DriverPrefKind | null;
};

/** Motoboys que já entregaram por esse restaurante ao menos uma vez, com a
 *  preferência atual (se houver). Base pra tela de favoritos/blacklist. */
export async function listKnownDrivers(db: DB, restaurantId: string): Promise<KnownDriver[]> {
  const { data: rows } = await db
    .from('orders')
    .select('motoboy_id, delivered_at, motoboys(id, full_name)')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'delivered')
    .not('motoboy_id', 'is', null)
    .order('delivered_at', { ascending: false })
    .limit(2000);

  const byDriver = new Map<string, { name: string; count: number; last: string | null }>();
  for (const r of rows ?? []) {
    if (!r.motoboy_id) continue;
    const name = (r.motoboys as unknown as { full_name?: string } | null)?.full_name ?? 'Entregador';
    const e = byDriver.get(r.motoboy_id) ?? { name, count: 0, last: null };
    e.count += 1;
    if (!e.last || (r.delivered_at && r.delivered_at > e.last)) e.last = r.delivered_at ?? e.last;
    byDriver.set(r.motoboy_id, e);
  }

  const { data: prefs } = await db
    .from('restaurant_driver_prefs')
    .select('motoboy_id, kind')
    .eq('restaurant_id', restaurantId);
  const prefByDriver = new Map((prefs ?? []).map((p) => [p.motoboy_id, p.kind as DriverPrefKind]));

  return Array.from(byDriver.entries())
    .map(([motoboyId, e]) => ({
      motoboyId,
      name: e.name,
      deliveriesForRestaurant: e.count,
      lastDeliveryAt: e.last,
      pref: prefByDriver.get(motoboyId) ?? null,
    }))
    .sort((a, b) => b.deliveriesForRestaurant - a.deliveriesForRestaurant);
}

/** Define (ou remove, com kind=null) a preferência do restaurante sobre um motoboy. */
export async function setDriverPref(
  db: DB,
  restaurantId: string,
  motoboyId: string,
  kind: DriverPrefKind | null,
): Promise<void> {
  if (kind == null) {
    await db.from('restaurant_driver_prefs').delete().eq('restaurant_id', restaurantId).eq('motoboy_id', motoboyId);
    return;
  }
  await db
    .from('restaurant_driver_prefs')
    .upsert({ restaurant_id: restaurantId, motoboy_id: motoboyId, kind }, { onConflict: 'restaurant_id,motoboy_id' });
}

/** Ids bloqueados e favoritos desse restaurante — usado no despacho. */
export async function getDriverPrefSets(
  db: DB,
  restaurantId: string,
): Promise<{ blocked: Set<string>; favorite: Set<string> }> {
  const { data } = await db.from('restaurant_driver_prefs').select('motoboy_id, kind').eq('restaurant_id', restaurantId);
  const blocked = new Set<string>();
  const favorite = new Set<string>();
  for (const row of data ?? []) {
    if (row.kind === 'blocked') blocked.add(row.motoboy_id);
    else if (row.kind === 'favorite') favorite.add(row.motoboy_id);
  }
  return { blocked, favorite };
}
