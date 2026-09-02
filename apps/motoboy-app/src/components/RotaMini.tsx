import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme/theme';

interface Props {
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  pickupKm?: number | null;
  totalKm?: number | null;
}

/**
 * Prévia visual da rota — coleta → entrega. Sem WebView nem tiles: um traço
 * orientado pela direção real entre os dois pontos, sobre uma grade discreta.
 * Carrega instantâneo dentro do overlay de oferta (nada de mapa pesado num
 * card que aparece e some em segundos). Espelha o RouteMini do PWA.
 */
export const RotaMini = React.memo(function RotaMini({ pickup, dropoff, pickupKm, totalKm }: Props): React.JSX.Element {
  const W = 300;
  const H = 96;
  const pad = 20;

  let ax = pad, ay = H - pad, bx = W - pad, by = pad;
  if (pickup && dropoff) {
    const dx = dropoff.lng - pickup.lng;
    const dy = pickup.lat - dropoff.lat;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const sx = ux !== 0 ? (W / 2 - pad) / Math.abs(ux) : Infinity;
    const sy = uy !== 0 ? (H / 2 - pad) / Math.abs(uy) : Infinity;
    const s = Math.min(sx, sy);
    ax = W / 2 - ux * s;
    ay = H / 2 - uy * s;
    bx = W / 2 + ux * s;
    by = H / 2 + uy * s;
  }

  const lineLen = Math.hypot(bx - ax, by - ay);
  const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;

  return (
    <View style={styles.wrap}>
      <View style={styles.canvas}>
        {/* grade */}
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={`v${i}`} style={[styles.gridV, { left: (W / 6) * i }]} />
        ))}
        {[1, 2].map((i) => (
          <View key={`h${i}`} style={[styles.gridH, { top: (H / 3) * i }]} />
        ))}
        {/* traço */}
        <View
          style={[
            styles.line,
            {
              width: lineLen,
              left: ax,
              top: ay - 1.5,
              transform: [{ translateX: 0 }, { rotate: `${angle}deg` }],
            },
          ]}
        />
        {/* pontos */}
        <View style={[styles.dot, styles.dotPickup, { left: ax - 7, top: ay - 7 }]} />
        <View style={[styles.dot, styles.dotDrop, { left: bx - 7, top: by - 7 }]} />
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>
          ● coleta{pickupKm != null ? ` · ${pickupKm.toFixed(1)} km` : ''}
        </Text>
        <Text style={styles.legendText}>
          ● entrega{totalKm != null ? ` · ${totalKm.toFixed(1)} km` : ''}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  canvas: { width: '100%', height: 96, backgroundColor: theme.colors.surfaceAlt },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: theme.colors.border, opacity: 0.6 },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: theme.colors.border, opacity: 0.6 },
  line: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    transformOrigin: 'left center',
  },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: theme.colors.surface },
  dotPickup: { backgroundColor: theme.colors.accent },
  dotDrop: { backgroundColor: theme.colors.primary },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  legendText: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textSecondary },
});
