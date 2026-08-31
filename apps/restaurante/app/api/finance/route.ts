import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { getLogisticsFinance, getUsageSummary, type Period } from '@leeva/shared/services';

const PERIODS: Period[] = ['today', 'yesterday', '7d', '30d'];

export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    const p = new URL(req.url).searchParams.get('period');
    const period = PERIODS.includes(p as Period) ? (p as Period) : '30d';
    const [logistics, saas] = await Promise.all([
      getLogisticsFinance(db, ctx.restaurantId, period),
      getUsageSummary(db, ctx.restaurantId),
    ]);
    return json({ logistics, saas });
  } catch (e) {
    return serverError(e);
  }
}
