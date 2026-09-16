import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './theme';

type Mode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'leeva-motoboy-theme-mode';

type Ctx = { theme: Theme; mode: Mode; setMode: (m: Mode) => void };
const ThemeCtx = createContext<Ctx>({ theme: darkTheme, mode: 'dark', setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [mode, setModeState] = useState<Mode>('dark');
  const [system, setSystem] = useState(Appearance.getColorScheme() ?? 'dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
      })
      .catch(() => {});
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme ?? 'dark'));
    return () => sub.remove();
  }, []);

  function setMode(m: Mode): void {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }

  const resolved = mode === 'system' ? system : mode;
  const theme = resolved === 'light' ? lightTheme : darkTheme;

  const value = useMemo(() => ({ theme, mode, setMode }), [theme, mode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/** Tema resolvido (light/dark) pra usar em StyleSheet e cores inline. */
export function useTheme(): Theme {
  return useContext(ThemeCtx).theme;
}

/** Modo escolhido (claro/escuro/automático) + trocar — pra tela de Perfil. */
export function useThemeMode(): { mode: Mode; setMode: (m: Mode) => void } {
  const ctx = useContext(ThemeCtx);
  return { mode: ctx.mode, setMode: ctx.setMode };
}
