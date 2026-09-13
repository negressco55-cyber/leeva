import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme/theme';

const TILE = 256;
const ZOOM = 16;

function project(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/**
 * Mapa "onde eu estou" pra tela inicial — mosaico de tiles reais (Carto),
 * centrado na posição do próprio motoboy, com um ícone de moto no meio.
 * Independente do GPS de bordo (RideContext/PositionContext) — pega a
 * própria leitura, só pra exibir; não interfere no rastreamento de entrega.
 */
export function LiveMapMini({ height = 260 }: { height?: number }): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    async function read(): Promise<void> {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.Balanced });
        if (mounted.current) setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      } catch {
        /* sem GPS agora — mostra o mapa vazio */
      }
    }
    void read();
    const id = setInterval(() => void read(), 20000);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, []);

  function onLayout(e: LayoutChangeEvent): void {
    setWidth(e.nativeEvent.layout.width);
  }

  if (!pos || !width) {
    return <View onLayout={onLayout} style={[styles.empty, { height }]} />;
  }

  const z = ZOOM;
  const c = project(pos.lat, pos.lng, z);
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
          source={{ uri: `https://${sub}.basemaps.cartocdn.com/light_all/${z}/${wx}/${ty}@2x.png` }}
          style={{ position: 'absolute', width: TILE, height: TILE, left: tx * TILE - originX, top: ty * TILE - originY }}
        />,
      );
    }
  }

  return (
    <View onLayout={onLayout} style={[styles.wrap, { height }]}>
      {tiles}
      <View style={styles.pin}>
        <Text style={styles.pinGlyph}>🛵</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#e7e6e1', position: 'relative', width: '100%' },
  empty: { backgroundColor: theme.colors.surfaceAlt, width: '100%' },
  pin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinGlyph: { fontSize: 18 },
});
