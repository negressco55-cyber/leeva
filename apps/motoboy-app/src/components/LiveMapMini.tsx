import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import type { Theme } from '../theme/theme';

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
 * Preenche TODO o espaço do pai (`style={{ flex: 1 }}` no wrapper de quem
 * usa) — mede a própria largura E altura, não recebe tamanho fixo.
 * Independente do GPS de bordo (RideContext/PositionContext), só exibição.
 */
export function LiveMapMini(): React.JSX.Element {
  const styles = makeStyles(useTheme());
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
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
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }));
  }

  if (!pos || !size || !size.width || !size.height) {
    return <View onLayout={onLayout} style={styles.empty} />;
  }

  const { width, height } = size;
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
      const sub = 'abc'[(tx + ty) % 3];
      tiles.push(
        // OSM padrão (sem chave) — o CARTO passou a exigir API key.
        <Image
          key={`${tx}-${ty}`}
          source={{ uri: `https://${sub}.tile.openstreetmap.org/${z}/${wx}/${ty}.png`, headers: { 'User-Agent': 'LeevaMotoboy/1.0 (contato@leeva.app)', Referer: 'https://leeva-motoboy.vercel.app' } }}
          style={{ position: 'absolute', width: TILE, height: TILE, left: tx * TILE - originX, top: ty * TILE - originY }}
        />,
      );
    }
  }

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      {tiles}
      <View style={styles.pin}>
        <Text style={styles.pinGlyph}>🛵</Text>
      </View>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    wrap: { flex: 1, overflow: 'hidden', backgroundColor: t.colors.surfaceAlt, position: 'relative' },
    empty: { flex: 1, backgroundColor: t.colors.surfaceAlt },
    pin: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 40,
      height: 40,
      marginLeft: -20,
      marginTop: -20,
      borderRadius: 20,
      backgroundColor: t.colors.primary,
      borderWidth: 3,
      borderColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinGlyph: { fontSize: 18 },
  });
}
