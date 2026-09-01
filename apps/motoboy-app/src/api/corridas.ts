import { apiClient } from './client';
import type { Corrida, HistoricoCorridasResponse, StatusCorrida } from '../types';

export async function aceitarCorrida(corridaId: string): Promise<Corrida> {
  const { data } = await apiClient.post<Corrida>(`/corridas/${corridaId}/aceitar`);
  return data;
}

export async function atualizarStatusCorrida(
  corridaId: string,
  status: StatusCorrida,
  codigoConfirmacao?: string
): Promise<Corrida> {
  const { data } = await apiClient.patch<Corrida>(`/corridas/${corridaId}/status`, {
    status,
    codigoConfirmacao,
  });
  return data;
}

export async function getHistoricoCorridas(page = 1): Promise<HistoricoCorridasResponse> {
  const { data } = await apiClient.get<HistoricoCorridasResponse>('/corridas/historico', {
    params: { page },
  });
  return data;
}

export async function getCorrida(corridaId: string): Promise<Corrida> {
  const { data } = await apiClient.get<Corrida>(`/corridas/${corridaId}`);
  return data;
}
