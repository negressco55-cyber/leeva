import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Salva a tabela de valores do entregador (política global de payout). */
export async function POST(req: Request) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return badRequest('config inválida');
  const num = (k: string) => Number(b[k]);
  for (const k of ['base', 'per_km', 'free_km', 'min_payout']) {
    if (!Number.isFinite(num(k)) || num(k) < 0) return badRequest(`valor inválido: ${k}`);
  }
  const GROUP_KEYS = ['group_stop_min', 'group_radius_km', 'group_max_stops'] as const;
  for (const k of GROUP_KEYS) {
    if (b[k] !== undefined && (!Number.isFinite(num(k)) || num(k) < 0)) {
      return badRequest(`valor inválido: ${k}`);
    }
  }

  try {
    const db = adminDb();
    const { data: pol } = await db
      .from('payout_policies')
      .select('id, config')
      .is('restaurant_id', null)
      .maybeSingle();
    const merged: Record<string, unknown> = {
      ...((pol?.config as object) ?? {}),
      base: num('base'),
      per_km: num('per_km'),
      free_km: num('free_km'),
      min_payout: num('min_payout'),
    };
    for (const k of GROUP_KEYS) {
      if (b[k] !== undefined) merged[k] = k === 'group_max_stops' ? Math.round(num(k)) : num(k);
    }
    if (pol) {
      await db.from('payout_policies').update({ config: merged as never, updated_at: new Date().toISOString() }).eq('id', pol.id);
    } else {
      await db.from('payout_policies').insert({ restaurant_id: null, name: 'Padrão Leeva', config: merged as never });
    }
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
