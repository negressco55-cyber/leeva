/**
 * COMPROVAÇÃO DE ENTREGA — GPS + foto.
 *
 * O botão "Entreguei" do app do motoboy chama isto com a localização atual e
 * o caminho da foto (já enviada ao storage). Regras:
 *   - tem GPS e está a <= DELIVERY_PROXIMITY_M do endereço  → confirma ('ok')
 *   - tem GPS e está longe demais                            → BLOQUEIA ('far')
 *   - sem GPS (permissão negada / falhou)                    → confirma, mas
 *     marca 'no_gps' pro restaurante/admin verem
 *   - foto é obrigatória sempre
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { haversineKm } from './geo';
import { advanceOrderStatus } from './orders';

type DB = SupabaseClient<Database>;

/** Raio (metros) dentro do qual "Entreguei" é aceito. */
export const DELIVERY_PROXIMITY_M = 150;

export type ConfirmDeliveryInput = {
  orderId: string;
  motoboyId: string;
  lat?: number | null;
  lng?: number | null;
  /** caminho da foto no storage. Opcional só para o app nativo em transição —
   *  o PWA sempre envia. */
  photoPath?: string | null;
};

export type ConfirmDeliveryResult =
  | { ok: true; gpsStatus: 'ok' | 'no_gps'; distanceM: number | null }
  | { ok: false; error: string; code?: 'too_far' | 'no_photo' | 'invalid_state'; distanceM?: number };

export async function confirmDeliveryWithProof(
  db: DB,
  input: ConfirmDeliveryInput,
): Promise<ConfirmDeliveryResult> {
  const { data: order } = await db
    .from('orders')
    .select('id, motoboy_id, status, latitude, longitude')
    .eq('id', input.orderId)
    .maybeSingle();
  if (!order || order.motoboy_id !== input.motoboyId) {
    return { ok: false, error: 'essa entrega não é sua', code: 'invalid_state' };
  }
  if (!['picked_up', 'in_route'].includes(order.status)) {
    return { ok: false, error: 'a entrega não está em rota', code: 'invalid_state' };
  }

  const hasGps =
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);
  const hasDest = order.latitude != null && order.longitude != null;

  let distanceM: number | null = null;
  let gpsStatus: 'ok' | 'far' | 'no_gps' = 'no_gps';

  if (hasGps && hasDest) {
    const km = haversineKm(
      { latitude: input.lat as number, longitude: input.lng as number },
      { latitude: Number(order.latitude), longitude: Number(order.longitude) },
    );
    distanceM = km == null ? null : Math.round(km * 1000);
    if (distanceM != null && distanceM <= DELIVERY_PROXIMITY_M) gpsStatus = 'ok';
    else gpsStatus = 'far';
  } else if (hasGps && !hasDest) {
    // sem coordenada do destino não dá pra checar — trata como sem GPS
    gpsStatus = 'no_gps';
  }

  if (gpsStatus === 'far') {
    return {
      ok: false,
      error: `Você está a ${distanceM} m do endereço. Chegue mais perto para confirmar a entrega.`,
      code: 'too_far',
      distanceM: distanceM ?? undefined,
    };
  }

  await db
    .from('orders')
    .update({
      delivered_lat: hasGps ? (input.lat as number) : null,
      delivered_lng: hasGps ? (input.lng as number) : null,
      delivery_distance_m: distanceM,
      delivery_gps_status: gpsStatus,
      delivery_photo_path: input.photoPath ?? null,
    })
    .eq('id', input.orderId);

  const adv = await advanceOrderStatus(db, input.orderId, 'delivered', {
    actorType: 'motoboy',
    actorId: input.motoboyId,
  });
  if (!adv.ok) return { ok: false, error: adv.error, code: 'invalid_state' };

  return { ok: true, gpsStatus, distanceM };
}
