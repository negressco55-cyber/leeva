import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { STATUS_LABEL, corStatus, theme } from '../theme/theme';

export const StatusBadge = React.memo(function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const cor = corStatus(status);
  return (
    <View style={[styles.badge, { backgroundColor: `${cor}22` }]}>
      <View style={[styles.dot, { backgroundColor: cor }]} />
      <Text style={[styles.label, { color: cor }]}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: theme.fonts.bodySemiBold, fontSize: 13 },
});
