import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, badRequest, serverError } from '@/lib/api';
import { getUsageSummary, changePlan } from '@leeva/shared/services';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    const usage = await getUsageSummary(db, ctx.restaurantId);
    const { data: plans } = await db
      .from('plans')
      .select('code, name, monthly_price, per_delivery_price, features, trial_days')
      .eq('active', true)
      .order('sort_order');
    return json({ usage, plans: plans ?? [] });
  } catch (e) {
    return serverError(e);
  }
}

/** Troca de plano — só o dono. */
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'restaurant_owner') return forbidden('Apenas o dono pode mudar o plano.');
  try {
    const { planCode } = (await req.json().catch(() => ({}))) as { planCode?: string };
    if (!planCode) return badRequest('planCode obrigatório');
    const r = await changePlan(adminDb(), ctx.restaurantId, planCode);
    if (!r.ok) return badRequest(r.error);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
