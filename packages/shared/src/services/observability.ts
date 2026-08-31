/**
 * OBSERVABILIDADE — ponto único de captura de erro.
 *
 * Hoje: grava em `error_events` (visível no painel admin) + console.
 * Amanhã: plugar Sentry/equivalente aqui, sem tocar nas rotas.
 *
 * NÃO enviar dados sensíveis (telefone, endereço, chaves, payload de
 * pagamento). Passe só o essencial em `detail`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type DB = SupabaseClient<Database>;

export type ErrorScope = 'api' | 'dispatch' | 'webhook' | 'integration' | 'billing' | 'db' | 'cron';

type SentryLike = { captureException: (e: unknown, hint?: unknown) => void };
let sentry: SentryLike | null = null;
/** Chamado uma vez no bootstrap da app se o SDK estiver instalado/configurado. */
export function registerErrorReporter(client: SentryLike) {
  sentry = client;
}

const SAFE_KEYS = /(phone|address|token|secret|key|password|card|cpf|email|payload)/i;
function sanitize(detail: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!detail) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (SAFE_KEYS.test(k)) continue;
    if (typeof v === 'string' && v.length > 300) out[k] = v.slice(0, 300);
    else if (v && typeof v === 'object') out[k] = '[obj]';
    else out[k] = v;
  }
  return out;
}

export async function captureError(
  db: DB | null,
  scope: ErrorScope,
  err: unknown,
  detail?: Record<string, unknown> & { restaurantId?: string },
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${scope}]`, message, detail ? sanitize(detail) : '');
  try {
    sentry?.captureException(err, { tags: { scope } });
  } catch {
    /* ignora */
  }
  if (!db) return;
  try {
    await db.from('error_events').insert({
      scope,
      message: message.slice(0, 500),
      detail: sanitize(detail) as Database['public']['Tables']['error_events']['Insert']['detail'],
      restaurant_id: detail?.restaurantId ?? null,
    });
  } catch {
    /* nunca deixa a captura de erro quebrar o fluxo */
  }
}
