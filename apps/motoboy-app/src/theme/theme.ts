/**
 * Tema do app nativo do motoboy. Alinhado ao Sistema de Design do Leeva
 * (docs/DESIGN-SYSTEM.md) na versão ESCURA — deliberado: o entregador usa
 * na rua, muitas vezes à noite, e tela escura poupa bateria.
 * Cor de marca: verde-pinho (não laranja).
 */

export const colors = {
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

export const theme = {
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
