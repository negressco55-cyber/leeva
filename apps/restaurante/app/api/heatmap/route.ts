import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, serverError } from '@/lib/api';
import { getHeatmap, getPlanFeatures, type Period } from '@leeva/shared/services';

const PERIODS: Period[] = ['today', 'yesterday', '7d', '30d'];

export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    const features = await getPlanFeatures(db, ctx.restaurantId);
    if (!features.heatmap) return forbidden('Heatmap disponível nos planos Pro e Business.');

    const p = new URL(req.url).searchParams.get('period');
    const period = PERIODS.includes(p as Period) ? (p as Period) : '7d';
    const data = await getHeatmap(db, ctx.restaurantId, period);
    return json(data);
  } catch (e) {
    return serverError(e);
  }
}
