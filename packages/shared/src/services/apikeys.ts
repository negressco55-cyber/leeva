/**
 * Chaves de API por restaurante. Guardamos só o hash (sha-256).
 * A resolução na borda usa service_role.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { sha256Hex, randomToken } from '../lib/crypto';

type DB = SupabaseClient<Database>;

export type ApiKeyResolution = { restaurantId: string; keyId: string | null; legacy: boolean } | null;

/**
 * Resolve a chave crua para o restaurante.
 * 1. tabela `api_keys` (recomendado)
 * 2. compat: `integrations.config.api_key_hash`
 * 3. dev: `LEEVA_API_KEY` global se houver 1 único restaurante
 */
export async function resolveApiKey(db: DB, apiKey: string): Promise<ApiKeyResolution> {
  if (!apiKey || apiKey.length < 16) return null;
  const hash = await sha256Hex(apiKey);

  const { data: k } = await db
    .from('api_keys')
    .select('id, restaurant_id, revoked_at')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .maybeSingle();
  if (k) {
    void db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', k.id).then(() => {});
    return { restaurantId: k.restaurant_id, keyId: k.id, legacy: false };
  }

  const { data: rows } = await db
    .from('integrations')
    .select('restaurant_id')
    .contains('config', { api_key_hash: hash })
    .limit(1);
  if (rows?.length) return { restaurantId: rows[0]!.restaurant_id, keyId: null, legacy: true };

  if (process.env.LEEVA_API_KEY && apiKey === process.env.LEEVA_API_KEY) {
    const { data: all } = await db.from('restaurants').select('id').limit(2);
    if (all?.length === 1) return { restaurantId: all[0]!.id, keyId: null, legacy: true };
  }
  return null;
}

export type IssuedApiKey = { id: string; key: string; last4: string; name: string };

/** Gera uma nova chave para o restaurante. Devolve a chave em claro UMA vez. */
export async function issueApiKey(
  db: DB,
  restaurantId: string,
  opts: { name?: string; createdBy?: string } = {},
): Promise<IssuedApiKey> {
  const key = `leeva_${randomToken(32)}`;
  const hash = await sha256Hex(key);
  const last4 = key.slice(-4);
  const { data, error } = await db
    .from('api_keys')
    .insert({
      restaurant_id: restaurantId,
      name: (opts.name ?? 'Chave de API').slice(0, 80),
      key_hash: hash,
      last4,
      created_by: opts.createdBy ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id, key, last4, name: opts.name ?? 'Chave de API' };
}

export async function listApiKeys(db: DB, restaurantId: string) {
  const { data } = await db
    .from('api_keys')
    .select('id, name, last4, created_at, last_used_at, revoked_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function revokeApiKey(db: DB, restaurantId: string, keyId: string): Promise<boolean> {
  const { data } = await db
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .select('id');
  return !!data?.length;
}
