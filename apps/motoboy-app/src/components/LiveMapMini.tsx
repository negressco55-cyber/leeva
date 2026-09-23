import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import type { Theme } from '../theme/theme';

/**
 * Fundo do card de status da tela inicial. Era um mosaico de tiles do
 * OpenStreetMap, mas o serviço gratuito bloqueou o app ("Access blocked");
 * virou um fundo liso na cor da marca. Só decoração — nada de rota aqui.
 */
export function LiveMapMini(): React.JSX.Element {
  const styles = makeStyles(useTheme());
  return <View style={styles.fill} />;
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: t.colors.primaryWeak },
  });
}
