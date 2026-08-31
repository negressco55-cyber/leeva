import { requireRestaurantContext, adminDb } from '@/lib/context';
import {
  DEFAULT_LOGISTICS_CONFIG,
  getPayoutPolicy,
  getUsageSummary,
} from '@leeva/shared/services';
import ConfigForm from './ConfigForm';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  const ctx = await requireRestaurantContext();
  const db = adminDb();

  const [{ data: rst }, payout, usage, { data: plans }] = await Promise.all([
    db
      .from('restaurants')
      .select('name, address, latitude, longitude, fleet_mode, logistics_config')
      .eq('id', ctx.restaurantId)
      .maybeSingle(),
    getPayoutPolicy(db, ctx.restaurantId),
    getUsageSummary(db, ctx.restaurantId),
    db
      .from('plans')
      .select('code, name, monthly_price, per_delivery_price, features')
      .eq('active', true)
      .order('sort_order'),
  ]);

  return (
    <ConfigForm
      isOwner={ctx.role === 'restaurant_owner'}
      initial={{
        name: rst?.name ?? '',
        latitude: rst?.latitude ?? null,
        longitude: rst?.longitude ?? null,
        fleetMode: rst?.fleet_mode ?? 'leeva',
        logistics: { ...DEFAULT_LOGISTICS_CONFIG, ...((rst?.logistics_config as object) ?? {}) },
        payout,
      }}
      currentPlan={usage.plan.code}
      plans={plans ?? []}
    />
  );
}
