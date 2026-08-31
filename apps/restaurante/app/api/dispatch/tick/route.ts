import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { dispatchTick } from '@leeva/shared/services';

/**
 * Nudge do motor de despacho para ESTE restaurante. Chamado pela central
 * de operações ao carregar/atualizar — mantém o despacho fluindo mesmo
 * sem o cron global. As operações são CAS/idempotentes.
 */
export async function POST() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const result = await dispatchTick(adminDb(), { source: 'nudge', restaurantId: ctx.restaurantId });
    return json({ ok: true, ...result });
  } catch (e) {
    return serverError(e);
  }
}
