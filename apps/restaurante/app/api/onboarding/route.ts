import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { ensureSubscription, changePlan, DEFAULT_LOGISTICS_CONFIG } from '@leeva/shared/services';

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const b = (await req.json().catch(() => ({}))) as {
      name?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      fleetMode?: string;
      customerFee?: number;
      serviceRadiusKm?: number;
      planCode?: string;
    };
    if (!b.name?.trim() || !b.address?.trim()) return badRequest('nome e endereço obrigatórios');

    const db = adminDb();
    const fleetMode = (
      ['own', 'leeva', 'hybrid'].includes(b.fleetMode ?? '') ? b.fleetMode : 'leeva'
    ) as 'own' | 'leeva' | 'hybrid';

    await db
      .from('restaurants')
      .update({
        name: b.name.trim().slice(0, 200),
        address: b.address.trim().slice(0, 500),
        latitude: typeof b.latitude === 'number' ? b.latitude : null,
        longitude: typeof b.longitude === 'number' ? b.longitude : null,
        fleet_mode: fleetMode,
        logistics_config: {
          ...DEFAULT_LOGISTICS_CONFIG,
          customer_fee: Math.min(100, Math.max(0, Number(b.customerFee) || DEFAULT_LOGISTICS_CONFIG.customer_fee)),
          service_radius_km: Math.min(50, Math.max(1, Number(b.serviceRadiusKm) || DEFAULT_LOGISTICS_CONFIG.service_radius_km)),
        },
        onboarding_completed: true,
      })
      .eq('id', ctx.restaurantId);

    await ensureSubscription(db, ctx.restaurantId, b.planCode ?? 'start');
    if (b.planCode) await changePlan(db, ctx.restaurantId, b.planCode);

    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
