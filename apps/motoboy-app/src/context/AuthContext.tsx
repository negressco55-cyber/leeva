import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as authApi from '../api/auth';
import { setAccessToken, setOnAuthFailure, setRefreshToken } from '../api/client';
import { getMotoboyMe } from '../api/motoboy';
import { disconnectSocket } from '../api/socket';
import type { LoginRequest, Motoboy, RegisterMotoboyRequest, User } from '../types';

const STORAGE_KEYS = {
  accessToken: '@levva/accessToken',
  refreshToken: '@levva/refreshToken',
  user: '@levva/user',
} as const;

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  motoboy: Motoboy | null;
  accessToken: string | null;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterMotoboyRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshMotoboyProfile: () => Promise<void>;
  setMotoboy: React.Dispatch<React.SetStateAction<Motoboy | null>>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [motoboy, setMotoboy] = useState<Motoboy | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  const logout = useCallback(async () => {
    setAccessToken(null);
    setRefreshToken(null);
    disconnectSocket();
    setUser(null);
    setMotoboy(null);
    setAccessTokenState(null);
    await AsyncStorage.multiRemove([STORAGE_KEYS.accessToken, STORAGE_KEYS.refreshToken, STORAGE_KEYS.user]);
  }, []);

  useEffect(() => {
    setOnAuthFailure(() => {
      void logout();
    });
    return () => setOnAuthFailure(null);
  }, [logout]);

  const persistSession = useCallback(
    async (nextUser: User, nextAccessToken: string, nextRefreshToken: string, nextMotoboy?: Motoboy) => {
      setAccessToken(nextAccessToken);
      setRefreshToken(nextRefreshToken);
      setUser(nextUser);
      setAccessTokenState(nextAccessToken);
      if (nextMotoboy) setMotoboy(nextMotoboy);

      await AsyncStorage.multiSet([
        [STORAGE_KEYS.accessToken, nextAccessToken],
        [STORAGE_KEYS.refreshToken, nextRefreshToken],
        [STORAGE_KEYS.user, JSON.stringify(nextUser)],
      ]);
    },
    []
  );

  const refreshMotoboyProfile = useCallback(async () => {
    const profile = await getMotoboyMe();
    setMotoboy(profile);
  }, []);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const response = await authApi.login(payload);
      await persistSession(response.user, response.accessToken, response.refreshToken, response.motoboy);
      await refreshMotoboyProfile();
    },
    [persistSession, refreshMotoboyProfile]
  );

  const register = useCallback(
    async (payload: RegisterMotoboyRequest) => {
      const response = await authApi.registerMotoboy(payload);
      await persistSession(response.user, response.accessToken, response.refreshToken, response.motoboy);
      await refreshMotoboyProfile();
    },
    [persistSession, refreshMotoboyProfile]
  );

  // Bootstrap: restaura sessão salva no AsyncStorage ao abrir o app.
  useEffect(() => {
    (async () => {
      try {
        const [[, storedAccessToken], [, storedRefreshToken], [, storedUser]] = await AsyncStorage.multiGet([
          STORAGE_KEYS.accessToken,
          STORAGE_KEYS.refreshToken,
          STORAGE_KEYS.user,
        ]);

        if (storedAccessToken && storedRefreshToken && storedUser) {
          setAccessToken(storedAccessToken);
          setRefreshToken(storedRefreshToken);
          setUser(JSON.parse(storedUser) as User);
          setAccessTokenState(storedAccessToken);
          await refreshMotoboyProfile();
        }
      } catch {
        // Sessão inválida/corrompida: segue para a tela de login.
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(user && accessToken),
      user,
      motoboy,
      accessToken,
      login,
      register,
      logout,
      refreshMotoboyProfile,
      setMotoboy,
    }),
    [isLoading, user, motoboy, accessToken, login, register, logout, refreshMotoboyProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa ser usado dentro de um AuthProvider');
  return context;
}
