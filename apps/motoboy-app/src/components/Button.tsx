import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import type { Theme } from '../theme/theme';

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Button = React.memo(function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const variantStyles = makeVariantStyles(t);
  const textVariantStyles = makeTextVariantStyles(t);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? t.colors.text : t.colors.onPrimary} />
      ) : (
        <Text style={[styles.label, textVariantStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
});

function makeStyles(t: Theme) {
  return StyleSheet.create({
    base: {
      borderRadius: t.radius.md,
      paddingVertical: 16,
      paddingHorizontal: t.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 54,
    },
    disabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontFamily: t.fonts.bodySemiBold,
      fontSize: 16,
    },
  });
}

function makeVariantStyles(t: Theme): Record<ButtonVariant, StyleProp<ViewStyle>> {
  return {
    primary: { backgroundColor: t.colors.primary },
    accent: { backgroundColor: t.colors.accent },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: t.colors.border },
    danger: { backgroundColor: t.colors.danger },
  };
}

function makeTextVariantStyles(t: Theme): Record<ButtonVariant, StyleProp<TextStyle>> {
  return {
    primary: { color: t.colors.onPrimary },
    accent: { color: t.colors.onAccent },
    outline: { color: t.colors.text },
    danger: { color: t.colors.text },
  };
}
