import { requireMotoboyContext, adminDb } from '@/lib/context';
import StatusToggle from './StatusToggle';

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const ctx = await requireMotoboyContext();
  const db = adminDb();

  const { count: activeCount } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('motoboy_id', ctx.motoboyId)
    .in('status', ['assigned', 'picked_up', 'in_route']);

  const { count: doneToday } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('motoboy_id', ctx.motoboyId)
    .eq('status', 'delivered')
    .gte('delivered_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

  return (
    <StatusToggle
      restaurantId={ctx.restaurantId}
      motoboyId={ctx.motoboyId}
      initialStatus={ctx.status}
      activeDeliveries={activeCount ?? 0}
      doneToday={doneToday ?? 0}
    />
  );
}
