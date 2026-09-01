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
