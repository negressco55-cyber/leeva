import { requireRestaurantContext, adminDb } from '@/lib/context';
import { DEFAULT_LOGISTICS_CONFIG, getUsageSummary } from '@leeva/shared/services';
import type { BusinessHours } from '@leeva/shared/services/business-hours';
import ConfigForm from './ConfigForm';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  const ctx = await requireRestaurantContext();
  const db = adminDb();

  const [{ data: rst }, usage, { data: plans }] = await Promise.all([
    db
      .from('restaurants')
      .select('name, address, phone, latitude, longitude, fleet_mode, logistics_config, business_hours')
      .eq('id', ctx.restaurantId)
      .maybeSingle(),
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
        address: rst?.address ?? '',
        whatsapp: rst?.phone ?? '',
        latitude: rst?.latitude ?? null,
        longitude: rst?.longitude ?? null,
        fleetMode: rst?.fleet_mode ?? 'leeva',
        logistics: { ...DEFAULT_LOGISTICS_CONFIG, ...((rst?.logistics_config as object) ?? {}) },
        businessHours: (rst?.business_hours as BusinessHours | null) ?? null,
      }}
      currentPlan={usage.plan.code}
      plans={plans ?? []}
    />
  );
}
