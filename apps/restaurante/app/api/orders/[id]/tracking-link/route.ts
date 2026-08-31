import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, serverError, orderBelongsTo } from '@/lib/api';
import { ensureTrackingToken } from '@leeva/shared/services';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const token = await ensureTrackingToken(db, id);
    if (!token) return serverError('ensureTrackingToken retornou null');

    const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
    return json({ ok: true, token, url: `${base}/track/${token}` });
  } catch (e) {
    return serverError(e);
  }
}
