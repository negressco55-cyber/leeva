import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { evaluateAlerts, getSituation } from '@leeva/shared/services';

export async function POST() {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const db = adminDb();
    const [alerts, situation] = await Promise.all([
      evaluateAlerts(db, ctx.restaurantId),
      getSituation(db, ctx.restaurantId),
    ]);
    return json({ alerts, situation });
  } catch (e) {
    return serverError(e);
  }
}
