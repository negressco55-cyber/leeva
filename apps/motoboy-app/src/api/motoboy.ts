import { apiGet, apiSend } from './client';
import type { MotoboyMe, Performance } from '../types';

export function getMe(): Promise<MotoboyMe> {
  return apiGet<MotoboyMe>('/api/me');
}

export async function setOnline(online: boolean): Promise<{ status: string }> {
  return apiSend<{ ok: boolean; status: string }>('/api/status', 'POST', { online });
}

export async function sendLocation(latitude: number, longitude: number): Promise<void> {
  await apiSend('/api/location', 'POST', { latitude, longitude });
}

export function getPerformance(): Promise<Performance> {
  return apiGet<Performance>('/api/performance');
}

export function acceptTerms(version: number): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>('/api/terms', 'POST', { version });
}

/** Registra o token de push do Expo no backend. */
export function registerExpoPush(token: string): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>('/api/push/expo', 'POST', { token });
}

/** Cadastra/troca a chave Pix do repasse. */
export function setPixKey(key: string, type: string): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>('/api/pix', 'POST', { key, type });
}

export type DriverDocsStatus = {
  personalDocUrl: string | null;
  vehicleDocUrl: string | null;
  avatarUrl: string | null;
};

/** Estado atual dos documentos (CNH/RG, CRLV, foto do rosto). */
export function getDriverDocs(): Promise<DriverDocsStatus> {
  return apiGet<DriverDocsStatus>('/api/documents');
}

/** Envia/substitui um documento. type: 'personal' | 'vehicle' | 'avatar'. */
export function uploadDriverDocument(type: 'personal' | 'vehicle' | 'avatar', fileBase64: string): Promise<{ ok: boolean } & DriverDocsStatus> {
  return apiSend('/api/documents', 'POST', { type, fileBase64 });
}

export type RequestPayoutResult =
  | { ok: true; amount: number; fee: number; netAmount: number; simulated: boolean }
  | { ok: false; error: string; code?: string };

/** Solicita o repasse do saldo disponível — por iniciativa do motoboy, 1x por dia. */
export function requestPayout(): Promise<RequestPayoutResult> {
  return apiSend('/api/payouts/request', 'POST');
}

export type PayoutHistoryEntry = {
  id: string;
  periodDate: string;
  amount: number;
  transferFee: number;
  netAmount: number;
  earningsCount: number;
  status: string;
  simulated: boolean;
  paidAt: string | null;
  error: string | null;
};

export type WalletInfo = {
  pendingAmount: number;
  pendingCount: number;
  requestedToday: boolean;
  transferFee: number;
  history: PayoutHistoryEntry[];
};

/** Saldo + histórico de repasses — aba Carteira. */
export function getWallet(): Promise<WalletInfo> {
  return apiGet<WalletInfo>('/api/payouts/history');
}
