import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** body: { packages: [{ id, amount, bonus, label, sort_order, active }] } */
export async function POST(req: Request) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { packages?: Record<string, unknown>[] };
  if (!Array.isArray(b.packages)) return badRequest('packages inválido');
  try {
    const db = adminDb();
    for (const p of b.packages) {
      const amount = Number(p.amount);
      const bonus = Number(p.bonus ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      await db.from('credit_packages').update({
        amount,
        bonus: Number.isFinite(bonus) && bonus >= 0 ? bonus : 0,
        label: p.label ? String(p.label).slice(0, 60) : null,
        sort_order: Math.round(Number(p.sort_order ?? 0)),
        active: !!p.active,
      }).eq('id', String(p.id));
    }
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
