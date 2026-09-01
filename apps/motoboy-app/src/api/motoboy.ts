import { apiClient } from './client';
import type { CorridasDisponiveisResponse, MotoboyMeResponse } from '../types';

export async function getMotoboyMe(): Promise<MotoboyMeResponse> {
  const { data } = await apiClient.get<MotoboyMeResponse>('/motoboys/me');
  return data;
}

export async function updateDisponibilidade(disponivel: boolean): Promise<MotoboyMeResponse> {
  const { data } = await apiClient.patch<MotoboyMeResponse>('/motoboys/me/disponibilidade', { disponivel });
  return data;
}

export async function updateLocalizacao(lat: number, lng: number): Promise<void> {
  await apiClient.patch('/motoboys/me/localizacao', { lat, lng });
}

export async function getCorridasDisponiveis(): Promise<CorridasDisponiveisResponse> {
  const { data } = await apiClient.get<CorridasDisponiveisResponse>('/corridas/disponiveis');
  return data;
}
