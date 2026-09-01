/**
 * Tema visual do Levva Motoboy — baseado em docs/brand-guide.md
 * Grafite (fundo) + laranja (ação) + amarelo (destaque/disponível) + verde (sucesso) + vermelho (alerta)
 * Tipografia: Space Grotesk (títulos) + Inter (corpo)
 */

export const colors = {
  grafite: '#17181C',
  grafiteClaro: '#1F2126',
  laranja: '#FF5A1F',
  amarelo: '#FFC93C',
  branco: '#F5F5F3',
  chumbo: '#3A3B42',
  verde: '#1FAA5A',
  vermelho: '#E5484D',
} as const;

export const theme = {
  colors: {
    background: colors.grafite,
    surface: colors.grafiteClaro,
    border: colors.chumbo,
    text: colors.branco,
    textSecondary: '#B8B9BE',
    primary: colors.laranja,
    accent: colors.amarelo,
    success: colors.verde,
    danger: colors.vermelho,
    onPrimary: colors.grafite,
    onAccent: colors.grafite,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 20,
    pill: 999,
  },
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

/** Cor de destaque por status de corrida, usada em badges e barras de progresso. */
export function corStatusCorrida(status: string): string {
  switch (status) {
    case 'PROCURANDO_MOTOBOY':
      return theme.colors.accent;
    case 'ACEITA':
    case 'A_CAMINHO_COLETA':
    case 'COLETADO':
    case 'A_CAMINHO_ENTREGA':
      return theme.colors.primary;
    case 'ENTREGUE':
      return theme.colors.success;
    case 'CANCELADA':
      return theme.colors.danger;
    default:
      return theme.colors.textSecondary;
  }
}
