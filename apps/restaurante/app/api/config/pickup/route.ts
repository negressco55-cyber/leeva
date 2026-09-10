import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, badRequest, serverError } from '@/lib/api';
import { resolvePickupLocation, deliveryLocationErrorMessage } from '@leeva/shared/services';

/**
 * Define o endereço do restaurante (ponto de coleta) a partir de um endereço
 * escrito — o servidor acha no mapa e grava as coordenadas. É daqui que sai a
 * distância de toda entrega.
 */
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'restaurant_owner') return forbidden('Apenas o dono pode alterar o endereço.');

  const b = (await req.json().catch(() => ({}))) as {
    address?: string;
    latitude?: number;
    longitude?: number;
    confirmed?: boolean;
  };
  const address = (b.address ?? '').trim();
  if (address.length < 6) {
    return badRequest('Digite o endereço completo: rua, número, bairro e cidade.');
  }

  const db = adminDb();
  try {
    const r = await resolvePickupLocation({
      address,
      latitude: b.latitude,
      longitude: b.longitude,
      confirmed: b.confirmed === true,
    });
    if (!r.ok) {
      return json(
        { error: deliveryLocationErrorMessage(r.reason), code: r.reason },
        r.reason === 'geocoder_unavailable' ? 503 : 400,
      );
    }
    await db
      .from('restaurants')
      .update({ address, latitude: r.latitude, longitude: r.longitude })
      .eq('id', ctx.restaurantId);
    return json({ ok: true, latitude: r.latitude, longitude: r.longitude, label: r.label, via: r.via });
  } catch (e) {
    return serverError(e);
  }
}
