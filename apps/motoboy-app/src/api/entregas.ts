import { apiGet, apiSend } from './client';
import type { Delivery, HistoricoResponse, Offer, OrderStatus, RouteSummary } from '../types';

export async function getOffers(): Promise<Offer[]> {
  const d = await apiGet<{ offers: Offer[] }>('/api/offers');
  return d.offers ?? [];
}

export function respondOffer(offerId: string, action: 'accept' | 'decline'): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>(`/api/offers/${offerId}`, 'POST', { action });
}

export async function getActiveDeliveries(): Promise<Delivery[]> {
  return (await getActiveRoute()).deliveries;
}

/** Entregas ativas já na ordem da rota + resumo (km, atraso, link do Google Maps). */
export async function getActiveRoute(): Promise<{ deliveries: Delivery[]; route: RouteSummary | null }> {
  const d = await apiGet<{ deliveries: Delivery[]; route?: RouteSummary }>('/api/entrega');
  return { deliveries: d.deliveries ?? [], route: d.route ?? null };
}

/** Ações na rota: reordenar, voltar pra ordem sugerida, "retirei todos". */
export function routeAction(
  body: { action: 'reorder'; orderIds: string[] } | { action: 'reset' } | { action: 'pickup_all' },
): Promise<{ ok: boolean; count?: number }> {
  return apiSend('/api/entrega/rota', 'POST', body);
}

export function advanceDelivery(
  orderId: string,
  status: OrderStatus,
  coords?: { lat: number; lng: number } | null,
): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>(`/api/deliveries/${orderId}`, 'POST', {
    action: 'status',
    status,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  });
}

/** Conclui a entrega: foto + código de confirmação do cliente (+ GPS, se disponível). */
export function deliverWithProof(
  orderId: string,
  input: { photoBase64: string; confirmationCode: string; ifoodConfirmed?: boolean; lat?: number | null; lng?: number | null },
): Promise<{ ok: boolean; gpsStatus?: string; distanceM?: number | null }> {
  return apiSend(`/api/deliveries/${orderId}`, 'POST', {
    action: 'deliver',
    photoBase64: input.photoBase64,
    confirmationCode: input.confirmationCode,
    ifoodConfirmed: input.ifoodConfirmed === true,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
  });
}

export function getHistorico(): Promise<HistoricoResponse> {
  return apiGet<HistoricoResponse>('/api/historico');
}
