/**
 * Tema do app nativo do motoboy. Duas paletas (claro/escuro), mesmos tokens
 * do Sistema de Design do Leeva (docs/DESIGN-SYSTEM.md — os mesmos valores
 * usados no PWA do motoboy). Modo escolhido em Perfil, ver ThemeContext.tsx.
 */

const colorsDark = {
  bg: '#14150f',
  surface: '#1c1e17',
  surface2: '#24261f',
  border: '#303228',
  borderStrong: '#3d3f34',
  text: '#ecece4',
  textSecondary: '#a4a49a',
  brand: '#34c98c',
  brandHover: '#46d69b',
  brandWeak: '#172a20',
  onBrand: '#052013',
  ok: '#55c47f',
  warn: '#d6a951',
  danger: '#e46a61',
} as const;

const colorsLight = {
  bg: '#f7f7f4',
  surface: '#ffffff',
  surface2: '#f0f0ec',
  border: '#e6e5df',
  borderStrong: '#d1d0c8',
  text: '#14140e',
  textSecondary: '#5d5d55',
  brand: '#0c8a5c',
  brandHover: '#0a744d',
  brandWeak: '#e1f2ea',
  onBrand: '#ffffff',
  ok: '#167c43',
  warn: '#8a5d05',
  danger: '#b0241c',
} as const;

const shared = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  fonts: {
    heading: 'SpaceGrotesk_700Bold',
    headingSemiBold: 'SpaceGrotesk_600SemiBold',
    headingMedium: 'SpaceGrotesk_500Medium',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
  },
} as const;

type ColorPalette = Record<keyof typeof colorsDark, string>;

function buildTheme(colors: ColorPalette, mode: 'light' | 'dark') {
  return {
    mode,
    colors: {
      background: colors.bg,
      surface: colors.surface,
      surfaceAlt: colors.surface2,
      border: colors.border,
      borderStrong: colors.borderStrong,
      text: colors.text,
      textSecondary: colors.textSecondary,
      primary: colors.brand,
      primaryWeak: colors.brandWeak,
      accent: colors.warn,
      success: colors.ok,
      danger: colors.danger,
      onPrimary: colors.onBrand,
      onAccent: mode === 'dark' ? colors.bg : '#ffffff',
    },
    ...shared,
  };
}

export const darkTheme = buildTheme(colorsDark, 'dark');
export const lightTheme = buildTheme(colorsLight, 'light');

/** Tema padrão (escuro) — só pra quem ainda importa `theme` direto (fora de
 *  componente, ex.: helpers). Dentro de componentes, use `useTheme()`. */
export const theme = darkTheme;

export type Theme = typeof darkTheme;

export function corStatus(t: Theme, status: string): string {
  switch (status) {
    case 'assigned':
    case 'picked_up':
    case 'in_route':
      return t.colors.primary;
    case 'delivered':
      return t.colors.success;
    case 'cancelled':
      return t.colors.danger;
    default:
      return t.colors.textSecondary;
  }
}

export const STATUS_LABEL: Record<string, string> = {
  assigned: 'A caminho da coleta',
  picked_up: 'Pedido coletado',
  in_route: 'Em entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};
