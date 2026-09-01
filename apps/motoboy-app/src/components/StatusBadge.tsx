import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { corStatusCorrida, theme } from '../theme/theme';
import type { StatusCorrida } from '../types';

const LABELS: Record<StatusCorrida, string> = {
  SOLICITADA: 'Solicitada',
  PROCURANDO_MOTOBOY: 'Procurando motoboy',
  ACEITA: 'Aceita',
  A_CAMINHO_COLETA: 'A caminho da coleta',
  COLETADO: 'Coletado',
  A_CAMINHO_ENTREGA: 'A caminho da entrega',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
};

export function StatusBadge({ status }: { status: StatusCorrida }): React.JSX.Element {
  const cor = corStatusCorrida(status);

  return (
    <View style={[styles.badge, { backgroundColor: `${cor}22`, borderColor: cor }]}>
      <View style={[styles.dot, { backgroundColor: cor }]} />
      <Text style={[styles.label, { color: cor }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 13,
  },
});
