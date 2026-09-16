import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import type { Theme } from '../theme/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Card = React.memo(function Card({ children, style }: CardProps): React.JSX.Element {
  const styles = makeStyles(useTheme());
  return <View style={[styles.card, style]}>{children}</View>;
});

function makeStyles(t: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
    },
  });
}
