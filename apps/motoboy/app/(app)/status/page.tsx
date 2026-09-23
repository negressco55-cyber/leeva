import { requireMotoboyContext, adminDb } from '@/lib/context';
import StatusToggle from './StatusToggle';
import NotificationSetup from '../_lib/NotificationSetup';

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const ctx = await requireMotoboyContext();
  const db = adminDb();
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [{ count: activeCount }, { data: deliveredToday }, { data: earnings }] = await Promise.all([
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('motoboy_id', ctx.motoboyId)
      .in('status', ['assigned', 'picked_up', 'in_route']),
    db
      .from('orders')
      .select('route_distance_km')
      .eq('motoboy_id', ctx.motoboyId)
      .eq('status', 'delivered')
      .gte('delivered_at', todayStart),
    db.from('driver_earnings').select('amount').eq('motoboy_id', ctx.motoboyId).gte('earned_at', todayStart),
  ]);

  const earnedToday = (earnings ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const kmToday = (deliveredToday ?? []).reduce((s, o) => s + Number(o.route_distance_km ?? 0), 0);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <StatusToggle
        restaurantId={ctx.restaurantId}
        motoboyId={ctx.motoboyId}
        fullName={ctx.fullName ?? 'Entregador'}
        initialStatus={ctx.status}
        activeDeliveries={activeCount ?? 0}
        doneToday={(deliveredToday ?? []).length}
        earnedToday={earnedToday}
        kmToday={kmToday}
        approved={ctx.approvalStatus === 'approved'}
      />
      <NotificationSetup askNow={ctx.status !== 'offline'} />
    </div>
  );
}
