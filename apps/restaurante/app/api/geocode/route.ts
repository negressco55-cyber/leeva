import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError, tooManyRequests } from '@/lib/api';
import { getMapProvider, checkRateLimit, GeocoderUnavailableError } from '@leeva/shared/services';

/** Geocoding de endereço → lat/lng (usado no formulário de nova entrega). */
export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const q = new URL(req.url).searchParams.get('q');
  if (!q || q.trim().length < 5) return badRequest('endereço muito curto');
  try {
    const rl = await checkRateLimit(adminDb(), 'geocode', ctx.restaurantId);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter);
    const { data: rst } = await adminDb()
      .from('restaurants')
      .select('latitude, longitude')
      .eq('id', ctx.restaurantId)
      .maybeSingle();
    const near =
      rst?.latitude != null && rst?.longitude != null
        ? { latitude: rst.latitude, longitude: rst.longitude }
        : undefined;
    const hit = await getMapProvider().geocode(q, near);
    if (!hit) return json({ ok: false, error: 'endereço não encontrado', code: 'address_not_found' }, 200);
    return json({ ok: true, ...hit });
  } catch (e) {
    if (e instanceof GeocoderUnavailableError) {
      return json({ ok: false, error: 'serviço de mapas instável', code: 'geocoder_unavailable' }, 503);
    }
    return serverError(e);
  }
}
