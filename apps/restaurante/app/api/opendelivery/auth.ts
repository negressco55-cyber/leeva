import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@leeva/shared/types';
import { resolveApiKey } from '@leeva/shared/services';

/**
 * Open Delivery autentica com OAuth2 (client_credentials). No Leeva o
 * client_secret É a chave de integração gerada no painel (Integrações), e o
 * access_token devolvido é ela mesma — então aceitamos `Authorization:
 * Bearer <chave>` ou `x-leeva-api-key: <chave>`.
 */
export async function restaurantFromOdAuth(db: SupabaseClient<Database>, req: Request): Promise<string | null> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const key = bearer || req.headers.get('x-leeva-api-key') || '';
  if (key.length < 16) return null;
  const r = await resolveApiKey(db, key);
  return r?.restaurantId ?? null;
}
