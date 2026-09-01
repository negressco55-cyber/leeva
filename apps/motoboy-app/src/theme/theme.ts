/**
 * Tema do app nativo do motoboy. Alinhado ao Sistema de Design do Leeva
 * (docs/DESIGN-SYSTEM.md) na versão ESCURA — deliberado: o entregador usa
 * na rua, muitas vezes à noite, e tela escura poupa bateria.
 * Cor de marca: verde-pinho (não laranja).
 */

export const colors = {
  bg: '#141513',
  surface: '#1c1e1b',
  surface2: '#242621',
  border: '#31332e',
  borderStrong: '#3d3f39',
  text: '#e9e9e4',
  textSecondary: '#a3a39a',
  brand: '#4fae93',
  brandHover: '#5cbfa2',
  onBrand: '#10231d',
  ok: '#63b98a',
  warn: '#d3a548',
  danger: '#e0685f',
} as const;

export const theme = {
  colors: {
    background: colors.bg,
    surface: colors.surface,
    surfaceAlt: colors.surface2,
    border: colors.border,
    text: colors.text,
    textSecondary: colors.textSecondary,
    primary: colors.brand,
    accent: colors.warn,
    success: colors.ok,
    danger: colors.danger,
    onPrimary: colors.onBrand,
    onAccent: colors.bg,
  },
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

export type Theme = typeof theme;

export function corStatus(status: string): string {
  switch (status) {
    case 'assigned':
    case 'picked_up':
    case 'in_route':
      return theme.colors.primary;
    case 'delivered':
      return theme.colors.success;
    case 'cancelled':
      return theme.colors.danger;
    default:
      return theme.colors.textSecondary;
  }
}

export const STATUS_LABEL: Record<string, string> = {
  assigned: 'A caminho da coleta',
  picked_up: 'Pedido coletado',
  in_route: 'Em entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};
