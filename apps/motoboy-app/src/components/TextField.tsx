import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import type { Theme } from '../theme/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, style, ...rest }: TextFieldProps): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={t.colors.textSecondary}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    wrapper: {
      marginBottom: t.spacing.md,
    },
    label: {
      fontFamily: t.fonts.bodyMedium,
      fontSize: 13,
      color: t.colors.textSecondary,
      marginBottom: 6,
    },
    input: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: t.spacing.md,
      paddingVertical: 14,
      color: t.colors.text,
      fontFamily: t.fonts.body,
      fontSize: 16,
    },
  });
}
