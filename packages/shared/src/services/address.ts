/**
 * Resolução e validação do endereço de ENTREGA antes de criar um pedido.
 *
 * Bug que isto corrige: era possível criar um pedido (e gerar tarifa + oferta
 * pro motoboy) com um endereço inventado — "rua aaaaa, número aaaaa" — porque
 * nada checava se o endereço existe de verdade. Agora o endereço passa pelo
 * geocoder e, sem uma localização confiável, o pedido não é criado.
 *
 * Três desfechos possíveis:
 *  - `ok`                    → coordenada confiável (geocodificada ou confirmada)
 *  - `address_not_found`     → o endereço não existe / não foi localizado → BLOQUEIA
 *  - `geocoder_unavailable`  → o serviço de mapas caiu (instabilidade de
 *                              terceiro) → NÃO bloqueia por padrão; pede uma
 *                              confirmação manual do restaurante
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { getMapProvider, GeocoderUnavailableError, type GeocodeResult } from './map';
import { haversineKm, isValidLatLng, type LatLng } from './geo';

type DB = SupabaseClient<Database>;

/**
 * Raio máximo plausível para uma entrega, a partir do ponto de coleta.
 * Uma correspondência de geocoding além disso é quase certamente um "match"
 * ruim (ex.: "Rua A" caiu em outro estado) — tratamos como não encontrado.
 */
export const MAX_DELIVERY_RADIUS_KM = 60;

export type DeliveryLocation =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      label: string | null;
      /** 'geocode' = veio do geocoder; 'confirmed' = coordenada confirmada pelo restaurante / sistema externo */
      via: 'geocode' | 'confirmed';
    }
  | { ok: false; reason: 'address_not_found' }
  | { ok: false; reason: 'geocoder_unavailable' };

export type ResolveInput = {
  address: string;
  /** coordenada que o cliente/sistema já mandou (pode ser confiável ou não) */
  latitude?: number | null;
  longitude?: number | null;
  /**
   * `true` quando a coordenada acima é confiável: o sistema externo geocodificou
   * do lado dele, OU o restaurante confirmou o ponto no mapa depois de uma
   * falha do geocoder. Sem isto, a coordenada só serve de dica.
   */
  confirmed?: boolean;
};

/** Ponto de coleta do restaurante (dica de proximidade + checagem de raio). */
async function restaurantNear(db: DB, restaurantId: string): Promise<LatLng | undefined> {
  const { data } = await db
    .from('restaurants')
    .select('latitude, longitude')
    .eq('id', restaurantId)
    .maybeSingle();
  return isValidLatLng(data?.latitude, data?.longitude)
    ? { latitude: data!.latitude as number, longitude: data!.longitude as number }
    : undefined;
}

function withinRadius(a: LatLng | undefined, b: LatLng): boolean {
  if (!a) return true; // restaurante sem coordenada → não dá pra checar
  const km = haversineKm(a, b);
  return km == null || km <= MAX_DELIVERY_RADIUS_KM;
}

export async function resolveDeliveryLocation(
  db: DB,
  restaurantId: string,
  input: ResolveInput,
): Promise<DeliveryLocation> {
  const near = await restaurantNear(db, restaurantId);
  const provided: LatLng | null = isValidLatLng(input.latitude, input.longitude)
    ? { latitude: input.latitude as number, longitude: input.longitude as number }
    : null;

  // coordenada já confirmada (sistema externo ou confirmação manual) e plausível
  const confirmedProvided =
    input.confirmed && provided && withinRadius(near, provided) ? provided : null;

  let hit: GeocodeResult | null = null;
  try {
    hit = await getMapProvider().geocode(input.address, near ?? provided ?? undefined);
  } catch (e) {
    if (e instanceof GeocoderUnavailableError) {
      // instabilidade de terceiro: não punir o restaurante. Se ele confirmou
      // um ponto, usa; senão pede confirmação.
      if (confirmedProvided) {
        return { ok: true, ...confirmedProvided, label: null, via: 'confirmed' };
      }
      return { ok: false, reason: 'geocoder_unavailable' };
    }
    throw e;
  }

  if (hit) {
    const hitLL: LatLng = { latitude: hit.latitude, longitude: hit.longitude };
    const plausible =
      withinRadius(near, hitLL) && hit.precision !== 'area' && hit.precision !== 'unknown';
    if (plausible) {
      return { ok: true, latitude: hit.latitude, longitude: hit.longitude, label: hit.label, via: 'geocode' };
    }
    // geocoder devolveu algo, mas fraco (só cidade/região) ou longe demais:
    // se o restaurante confirmou um ponto, respeita; senão, não encontrado.
    if (confirmedProvided) {
      return { ok: true, ...confirmedProvided, label: hit.label, via: 'confirmed' };
    }
    return { ok: false, reason: 'address_not_found' };
  }

  // geocoder respondeu "nada": endereço não existe
  if (confirmedProvided) {
    return { ok: true, ...confirmedProvided, label: null, via: 'confirmed' };
  }
  return { ok: false, reason: 'address_not_found' };
}

/**
 * Resolve o endereço de entrega de um NormalizedOrder e GRAVA a coordenada
 * de volta nele. Açúcar para as rotas de intake — em uma linha:
 *
 *   const r = await resolveAndApplyDeliveryLocation(db, restaurantId, parsed.order, { confirmed });
 *   if (!r.ok) return json({ error: deliveryLocationErrorMessage(r.reason), code: r.reason }, ...);
 */
export async function resolveAndApplyDeliveryLocation(
  db: DB,
  restaurantId: string,
  order: { address: { formatted: string; latitude?: number | null; longitude?: number | null } },
  opts: { confirmed?: boolean } = {},
): Promise<{ ok: true; via: 'geocode' | 'confirmed' } | { ok: false; reason: 'address_not_found' | 'geocoder_unavailable' }> {
  const loc = await resolveDeliveryLocation(db, restaurantId, {
    address: order.address.formatted,
    latitude: order.address.latitude,
    longitude: order.address.longitude,
    confirmed: opts.confirmed,
  });
  if (!loc.ok) return loc;
  order.address.latitude = loc.latitude;
  order.address.longitude = loc.longitude;
  return { ok: true, via: loc.via };
}

/** Mensagem pronta pro restaurante, por motivo. */
export function deliveryLocationErrorMessage(reason: 'address_not_found' | 'geocoder_unavailable'): string {
  return reason === 'geocoder_unavailable'
    ? 'O serviço de mapas está instável agora. Tente de novo em alguns segundos.'
    : 'Não conseguimos localizar esse endereço de entrega. Confira a rua, o número e o bairro e tente de novo.';
}

/**
 * Valida o endereço de COLETA (o ponto do restaurante). Mesma ideia, sem a
 * checagem de raio (não há ponto de referência anterior confiável). Usado no
 * onboarding e na edição do endereço do restaurante.
 */
export async function resolvePickupLocation(
  input: ResolveInput,
): Promise<DeliveryLocation> {
  const provided: LatLng | null = isValidLatLng(input.latitude, input.longitude)
    ? { latitude: input.latitude as number, longitude: input.longitude as number }
    : null;
  const confirmedProvided = input.confirmed && provided ? provided : null;

  let hit: GeocodeResult | null = null;
  try {
    hit = await getMapProvider().geocode(input.address, provided ?? undefined);
  } catch (e) {
    if (e instanceof GeocoderUnavailableError) {
      return confirmedProvided
        ? { ok: true, ...confirmedProvided, label: null, via: 'confirmed' }
        : { ok: false, reason: 'geocoder_unavailable' };
    }
    throw e;
  }

  if (hit && hit.precision !== 'area' && hit.precision !== 'unknown') {
    return { ok: true, latitude: hit.latitude, longitude: hit.longitude, label: hit.label, via: 'geocode' };
  }
  if (confirmedProvided) {
    return { ok: true, ...confirmedProvided, label: hit?.label ?? null, via: 'confirmed' };
  }
  return { ok: false, reason: 'address_not_found' };
}
