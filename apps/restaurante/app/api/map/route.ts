import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { getMapData, mapClientConfig, dispatchTick } from '@leeva/shared/services';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const db = adminDb();
    // mantém o despacho fluindo enquanto a central estiver aberta
    void dispatchTick(db, { source: 'nudge', restaurantId: ctx.restaurantId }).catch(() => {});
    const data = await getMapData(db, ctx.restaurantId);
    return json({ ...data, map: mapClientConfig() });
  } catch (e) {
    return serverError(e);
  }
}
