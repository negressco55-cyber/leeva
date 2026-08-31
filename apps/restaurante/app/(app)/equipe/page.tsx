import { redirect } from 'next/navigation';
import { requireRestaurantContext, adminDb } from '@/lib/context';
import { MOTOBOY_STATUS_LABELS, formatDateTime } from '@leeva/shared';
import TeamManager from './TeamManager';

export const dynamic = 'force-dynamic';

export default async function EquipePage() {
  const ctx = await requireRestaurantContext();
  const db = adminDb();

  const { data: rst } = await db.from('restaurants').select('fleet_mode').eq('id', ctx.restaurantId).maybeSingle();
  if (rst?.fleet_mode !== 'own' && rst?.fleet_mode !== 'hybrid') redirect('/dashboard');

  const { data: team } = await db
    .from('motoboys')
    .select('id, full_name, phone, status, active, user_id, deliveries_completed, deliveries_late, avg_delay_min, rating, location_updated_at')
    .eq('restaurant_id', ctx.restaurantId)
    .eq('fleet', 'own')
    .order('full_name');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Minha equipe</h1>
          <div className="sub">Seus entregadores. O Leeva despacha automaticamente entre eles.</div>
        </div>
      </div>
      <TeamManager
        team={(team ?? []).map((m) => ({
          ...m,
          statusLabel: MOTOBOY_STATUS_LABELS[m.status],
          lastSeen: m.location_updated_at ? formatDateTime(m.location_updated_at) : null,
        }))}
      />
    </>
  );
}
