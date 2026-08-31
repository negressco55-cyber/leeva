import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, notFound, serverError, orderBelongsTo } from '@/lib/api';
import { getOrderTimeline } from '@leeva/shared/services';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();
    const { id } = await params;
    const db = adminDb();
    if (!(await orderBelongsTo(db, id, ctx.restaurantId))) return forbidden();

    const { data: order } = await db
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .maybeSingle();
    if (!order) return notFound();

    const [timeline, tracking, notifications, attempts] = await Promise.all([
      getOrderTimeline(db, id),
      db
        .from('tracking_tokens')
        .select('token')
        .eq('order_id', id)
        .eq('revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('notifications')
        .select('channel, template, body, status, error, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      db
        .from('dispatch_attempts')
        .select('attempt_number, outcome, reason, offered_at, score')
        .eq('order_id', id)
        .order('attempt_number', { ascending: true }),
    ]);

    const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
    return json({
      order,
      timeline,
      trackingUrl: tracking.data?.token ? `${base}/track/${tracking.data.token}` : null,
      notifications: notifications.data ?? [],
      dispatchAttempts: attempts.data ?? [],
    });
  } catch (e) {
    return serverError(e);
  }
}
