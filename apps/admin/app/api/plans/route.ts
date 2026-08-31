import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, businessError, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** cria ou atualiza um plano (upsert por `code`). */
export async function POST(req: Request) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b.code !== 'string') return badRequest('code obrigatório');

  const row = {
    code: String(b.code).trim().toLowerCase().slice(0, 40),
    name: String(b.name ?? b.code).slice(0, 80),
    monthly_price: Number(b.monthly_price ?? 0),
    per_delivery_price: Number(b.per_delivery_price ?? 0),
    trial_days: Math.max(0, Math.round(Number(b.trial_days ?? 14))),
    sort_order: Math.round(Number(b.sort_order ?? 0)),
    active: !!b.active,
    features: (b.features ?? {}) as Record<string, unknown>,
  };
  if (!Number.isFinite(row.monthly_price) || row.monthly_price < 0) return businessError('mensalidade inválida');
  if (!Number.isFinite(row.per_delivery_price) || row.per_delivery_price < 0) return businessError('valor por entrega inválido');
  if (typeof row.features !== 'object' || Array.isArray(row.features)) return businessError('features deve ser um objeto JSON');

  try {
    const { data, error } = await adminDb()
      .from('plans')
      .upsert(row as never, { onConflict: 'code' })
      .select('id, code')
      .maybeSingle();
    if (error) return serverError(error);
    return json({ ok: true, plan: data });
  } catch (e) {
    return serverError(e);
  }
}
