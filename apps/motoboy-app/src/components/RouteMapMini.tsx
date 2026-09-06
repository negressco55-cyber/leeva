import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme/theme';

const TILE = 256;

interface Props {
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  width: number;
  height?: number;
}

function project(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function pickZoom(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const span = Math.max(Math.abs(a.lat - b.lat), Math.abs(a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180));
  if (span <= 0) return 15;
  const z = Math.log2((360 * 2.2) / (span * 3));
  return Math.max(11, Math.min(16, Math.round(z)));
}

/**
 * Mini-mapa real da corrida — mosaico de tiles (Carto dark, raster, sem chave
 * nem biblioteca) com traço e pinos por cima. Estático. Espelha o RouteMap do
 * PWA. Nada de WebView num card que aparece e some em segundos.
 */
export const RouteMapMini = React.memo(function RouteMapMini({ pickup, dropoff, width, height = 148 }: Props): React.JSX.Element {
  if (!pickup || !dropoff) {
    return <View style={[styles.empty, { width, height }]} />;
  }

  const z = pickZoom(pickup, dropoff);
  const c = project((pickup.lat + dropoff.lat) / 2, (pickup.lng + dropoff.lng) / 2, z);
  const originX = c.x * TILE - width / 2;
  const originY = c.y * TILE - height / 2;
  const tx0 = Math.floor(originX / TILE);
  const ty0 = Math.floor(originY / TILE);
  const cols = Math.ceil(width / TILE) + 2;
  const rows = Math.ceil(height / TILE) + 2;
  const nTiles = 2 ** z;

  const tiles: React.JSX.Element[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const tx = tx0 + i;
      const ty = ty0 + j;
      if (ty < 0 || ty >= nTiles) continue;
      const wx = ((tx % nTiles) + nTiles) % nTiles;
      const sub = 'abcd'[(tx + ty) % 4];
      tiles.push(
        <Image
          key={`${tx}-${ty}`}
          source={{ uri: `https://${sub}.basemaps.cartocdn.com/dark_all/${z}/${wx}/${ty}@2x.png` }}
          style={{ position: 'absolute', width: TILE, height: TILE, left: tx * TILE - originX, top: ty * TILE - originY }}
        />,
      );
    }
  }

  const toPx = (p: { lat: number; lng: number }) => {
    const q = project(p.lat, p.lng, z);
    return { x: q.x * TILE - originX, y: q.y * TILE - originY };
  };
  const a = toPx(pickup);
  const b = toPx(dropoff);
  const lineLen = Math.hypot(b.x - a.x, b.y - a.y);
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

  return (
    <View style={[styles.wrap, { width, height }]}>
      {tiles}
      <View
        style={[
          styles.line,
          { width: lineLen, left: a.x, top: a.y - 2, transform: [{ rotate: `${angle}deg` }] },
        ]}
      />
      <View style={[styles.pin, styles.pinPickup, { left: a.x - 7, top: a.y - 7 }]} />
      <View style={[styles.pin, styles.pinDrop, { left: b.x - 7, top: b.y - 7 }]} />
      <Text style={styles.attr}>© OpenStreetMap · CARTO</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#10110f', position: 'relative' },
  empty: { backgroundColor: theme.colors.surfaceAlt },
  line: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    transformOrigin: 'left center',
  },
  pin: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#fff' },
  pinPickup: { backgroundColor: theme.colors.accent },
  pinDrop: { backgroundColor: theme.colors.primary },
  attr: {
    position: 'absolute',
    right: 4,
    bottom: 3,
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
