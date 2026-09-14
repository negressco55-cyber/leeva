import { apiGet, apiSend } from './client';
import type { Delivery, HistoricoResponse, Offer, OrderStatus } from '../types';

export async function getOffers(): Promise<Offer[]> {
  const d = await apiGet<{ offers: Offer[] }>('/api/offers');
  return d.offers ?? [];
}

export function respondOffer(offerId: string, action: 'accept' | 'decline'): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>(`/api/offers/${offerId}`, 'POST', { action });
}

export async function getActiveDeliveries(): Promise<Delivery[]> {
  const d = await apiGet<{ deliveries: Delivery[] }>('/api/entrega');
  return d.deliveries ?? [];
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
  input: { photoBase64: string; confirmationCode: string; lat?: number | null; lng?: number | null },
): Promise<{ ok: boolean; gpsStatus?: string; distanceM?: number | null }> {
  return apiSend(`/api/deliveries/${orderId}`, 'POST', {
    action: 'deliver',
    photoBase64: input.photoBase64,
    confirmationCode: input.confirmationCode,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
  });
}

export function getHistorico(): Promise<HistoricoResponse> {
  return apiGet<HistoricoResponse>('/api/historico');
}
