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

  const { data: active } = await db
    .from('plans')
    .select('code, name, monthly_price, per_delivery_margin, features, trial_days')
    .eq('active', true)
    .order('sort_order');
  // modelo atual: só mensalidade — planos com taxa por entrega ficam de fora
  // (se o plano mensal ainda não existir no banco, mostra os ativos pra não travar o cadastro)
  const monthly = (active ?? []).filter((p) => Number(p.per_delivery_margin) === 0 && Number(p.monthly_price) > 0);
  const plans = monthly.length ? monthly : active;

  return (
    <OnboardingFlow
      restaurantName={ctx.restaurantName}
      initial={{
        name: rst?.name ?? ctx.restaurantName,
        address: rst?.address ?? '',
        latitude: rst?.latitude ?? null,
        longitude: rst?.longitude ?? null,
        fleetMode: 'own',
        logistics: (rst?.logistics_config as Record<string, unknown>) ?? {},
      }}
      plans={plans ?? []}
    />
  );
}
