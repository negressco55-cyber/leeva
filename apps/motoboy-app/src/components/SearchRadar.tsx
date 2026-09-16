import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Bike } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import type { Theme } from '../theme/theme';

const RING_COUNT = 3;
const RING_STAGGER_MS = 750;
const RING_DURATION_MS = 2400;

/**
 * Três anéis pulsando pra fora, tipo radar — usado enquanto o motoboy está
 * "Disponível" e sem oferta no momento. Substitui o mapa como elemento
 * central nesse estado (o mapa fica só de fundo discreto, ver HomeScreen).
 */
export function SearchRadar({ size = 220 }: { size?: number }): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const values = useRef(Array.from({ length: RING_COUNT }, () => new Animated.Value(0))).current;

  useEffect(() => {
    let mounted = true;
    function runRing(v: Animated.Value, initialDelay: number): void {
      v.setValue(0);
      Animated.sequence([
        Animated.delay(initialDelay),
        Animated.timing(v, {
          toValue: 1,
          duration: RING_DURATION_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && mounted) runRing(v, 0);
      });
    }
    values.forEach((v, i) => runRing(v, i * RING_STAGGER_MS));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
            },
          ]}
        />
      ))}
      <View style={styles.core}>
        <Bike size={30} color={t.colors.onPrimary} strokeWidth={2.2} />
      </View>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    ring: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: 999,
      borderWidth: 2,
      borderColor: t.colors.primary,
    },
    core: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: t.colors.primary,
      shadowOpacity: 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
  });
}
