import { apiClient } from './client';
import type { AuthResponse, LoginRequest, RegisterMotoboyRequest } from '../types';

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function registerMotoboy(payload: RegisterMotoboyRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register/motoboy', payload);
  return data;
}
