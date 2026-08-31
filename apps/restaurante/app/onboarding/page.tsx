import { redirect } from 'next/navigation';
import { requireRestaurantContext, adminDb } from '@/lib/context';
import OnboardingFlow from './OnboardingFlow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const ctx = await requireRestaurantContext();
  const db = adminDb();
  const { data: rst } = await db
    .from('restaurants')
    .select('name, address, latitude, longitude, fleet_mode, logistics_config, onboarding_completed')
    .eq('id', ctx.restaurantId)
    .maybeSingle();

  if (rst?.onboarding_completed) redirect('/dashboard');

  const { data: plans } = await db
    .from('plans')
    .select('code, name, monthly_price, per_delivery_price, features, trial_days')
    .eq('active', true)
    .order('sort_order');

  return (
    <OnboardingFlow
      restaurantName={ctx.restaurantName}
      initial={{
        name: rst?.name ?? ctx.restaurantName,
        address: rst?.address ?? '',
        latitude: rst?.latitude ?? null,
        longitude: rst?.longitude ?? null,
        fleetMode: rst?.fleet_mode ?? 'leeva',
        logistics: (rst?.logistics_config as Record<string, unknown>) ?? {},
      }}
      plans={plans ?? []}
    />
  );
}
