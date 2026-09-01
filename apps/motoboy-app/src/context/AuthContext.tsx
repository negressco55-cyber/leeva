import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { signIn, signOut } from '../api/auth';
import { getMe } from '../api/motoboy';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { MotoboyMe } from '../types';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  configured: boolean;
  me: MotoboyMe | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [me, setMe] = useState<MotoboyMe | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const profile = await getMe();
      setMe(profile);
    } catch {
      // token inválido / motoboy não encontrado → trata como deslogado
      setMe(null);
      setHasSession(false);
      await supabase.auth.signOut().catch(() => {});
    }
  }, []);

  const login = useCallback(
    async (email: string, senha: string) => {
      await signIn(email.trim().toLowerCase(), senha);
      setHasSession(true);
      await refreshMe();
    },
    [refreshMe],
  );

  const logout = useCallback(async () => {
    await signOut();
    setHasSession(false);
    setMe(null);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setHasSession(true);
        await refreshMe();
      }
      setIsLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      if (!session) setMe(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshMe]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: hasSession && !!me,
      configured: isSupabaseConfigured(),
      me,
      login,
      logout,
      refreshMe,
    }),
    [isLoading, hasSession, me, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return ctx;
}
