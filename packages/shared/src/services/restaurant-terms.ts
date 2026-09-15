/**
 * Termos de uso do restaurante — mesmo mecanismo do motoboy (drivers.ts),
 * reaproveitando terms_versions (audience='restaurant') mas com tabela de
 * aceite própria (restaurant_terms_acceptance) e coluna própria
 * (restaurants.terms_accepted_version).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type DB = SupabaseClient<Database>;

export async function acceptRestaurantTerms(
  db: DB,
  restaurantId: string,
  version: number,
  ip?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { error: aErr } = await db
    .from('restaurant_terms_acceptance')
    .upsert({ restaurant_id: restaurantId, terms_version: version, ip: ip ?? null }, { onConflict: 'restaurant_id,terms_version' });
  if (aErr) return { ok: false, error: 'não foi possível registrar o aceite' };
  await db.from('restaurants').update({ terms_accepted_version: version }).eq('id', restaurantId);
  return { ok: true };
}
