import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme/theme';

interface Props {
  name: string;
  src?: string | null;
  size?: number;
}

/**
 * Avatar do entregador: foto quando existe, senão as iniciais num círculo.
 * A foto vem da selfie aprovada na verificação de identidade
 * (ver docs/VERIFICACAO-DE-IDENTIDADE.md).
 */
export const Avatar = React.memo(function Avatar({ name, src, size = 56 }: Props): React.JSX.Element {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (src) {
    return <Image source={{ uri: src }} style={[styles.img, dim]} />;
  }
  return (
    <View style={[styles.circle, dim]}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>{initials || '🛵'}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  img: { backgroundColor: theme.colors.surfaceAlt },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryWeak,
  },
  initials: { fontFamily: theme.fonts.headingSemiBold, color: theme.colors.primary, letterSpacing: 0.5 },
});
