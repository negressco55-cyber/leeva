import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { STATUS_LABEL, corStatus, type Theme } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';

export const StatusBadge = React.memo(function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const cor = corStatus(t, status);
  return (
    <View style={[styles.badge, { backgroundColor: `${cor}22` }]}>
      <View style={[styles.dot, { backgroundColor: cor }]} />
      <Text style={[styles.label, { color: cor }]}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
});

function makeStyles(t: Theme) {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: t.radius.pill,
      gap: 6,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    label: { fontFamily: t.fonts.bodySemiBold, fontSize: 13 },
  });
}
