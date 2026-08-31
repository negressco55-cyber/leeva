/**
 * RATE LIMITING — janela deslizante com estado no banco (função SQL
 * `rate_limit_check`). Funciona em ambiente serverless (Vercel), onde
 * estado em memória de processo não é confiável entre instâncias.
 *
 * Uso nas rotas sensíveis (deliveries, tracking, webhooks, cron).
 * Para volume muito alto, trocar a implementação por Redis/Upstash
 * mantendo a mesma assinatura.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type DB = SupabaseClient<Database>;

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfter: number; // segundos
};

/** Limites padrão por tipo de endpoint (requisições por janela). */
export const RATE_LIMITS = {
  deliveries: { limit: 120, windowSeconds: 60 }, // por restaurante
  tracking: { limit: 60, windowSeconds: 60 }, // por IP
  webhook: { limit: 300, windowSeconds: 60 }, // por provedor+restaurante
  geocode: { limit: 30, windowSeconds: 60 }, // por restaurante
  auth: { limit: 10, windowSeconds: 60 }, // por IP
  default: { limit: 60, windowSeconds: 60 },
} as const;

export type RateLimitKind = keyof typeof RATE_LIMITS;

/**
 * Consome 1 do bucket `<kind>:<id>` e diz se está dentro do limite.
 * Nunca lança: em erro de infra, "fail open" (permite) mas loga.
 */
export async function checkRateLimit(
  db: DB,
  kind: RateLimitKind,
  id: string,
  override?: { limit?: number; windowSeconds?: number },
): Promise<RateLimitResult> {
  const base = RATE_LIMITS[kind] ?? RATE_LIMITS.default;
  const limit = override?.limit ?? base.limit;
  const windowSeconds = override?.windowSeconds ?? base.windowSeconds;
  const bucket = `${kind}:${id}`.slice(0, 200);

  try {
    const { data, error } = await db.rpc('rate_limit_check', {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      allowed: !!row?.allowed,
      count: Number(row?.current_count ?? 0),
      limit,
      retryAfter: Number(row?.retry_after ?? 0),
    };
  } catch (e) {
    console.error('[ratelimit] falha (fail-open):', e instanceof Error ? e.message : e);
    return { allowed: true, count: 0, limit, retryAfter: 0 };
  }
}

/** Extrai um identificador de cliente do request (IP) para limites por IP. */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    'desconhecido'
  );
}
