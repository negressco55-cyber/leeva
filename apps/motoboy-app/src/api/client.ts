import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import type { RefreshResponse } from '../types';

/**
 * Base URL configurável via EXPO_PUBLIC_API_URL (.env). Metro/Expo expõe
 * automaticamente qualquer variável prefixada com EXPO_PUBLIC_ em process.env.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Tokens mantidos em memória (fonte da verdade fica no AuthContext + AsyncStorage;
// aqui guardamos só uma cópia rápida para os interceptors não dependerem de I/O assíncrono).
let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;
let onAuthFailure: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

export function setRefreshToken(token: string | null): void {
  currentRefreshToken = token;
}

/** Registrado pelo AuthContext: chamado quando o refresh falha (força logout). */
export function setOnAuthFailure(callback: (() => void) | null): void {
  onAuthFailure = callback;
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (currentAccessToken) {
    config.headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!currentRefreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post<RefreshResponse>(`${API_URL}/auth/refresh`, { refreshToken: currentRefreshToken })
      .then((response) => {
        currentAccessToken = response.data.accessToken;
        return response.data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();

      if (newToken) {
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        return apiClient(originalRequest);
      }

      onAuthFailure?.();
    }

    return Promise.reject(error);
  }
);
