import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useRide } from '../../context/RideContext';
import { theme } from '../../theme/theme';

const SEGUNDOS_PARA_DECIDIR = 15;

export function NovaCorridaOverlay(): React.JSX.Element | null {
  const { ofertaCorrida, aceitarOferta, recusarOferta } = useRide();
  const [segundosRestantes, setSegundosRestantes] = useState(SEGUNDOS_PARA_DECIDIR);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (!ofertaCorrida) {
      setSegundosRestantes(SEGUNDOS_PARA_DECIDIR);
      setProcessando(false);
      return;
    }

    setSegundosRestantes(SEGUNDOS_PARA_DECIDIR);
    const interval = setInterval(() => {
      setSegundosRestantes((atual) => {
        if (atual <= 1) {
          clearInterval(interval);
          recusarOferta();
          return 0;
        }
        return atual - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofertaCorrida?.corridaId]);

  if (!ofertaCorrida) return null;

  async function handleAceitar(): Promise<void> {
    setProcessando(true);
    await aceitarOferta();
    setProcessando(false);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Nova corrida</Text>
          <Text style={styles.timer}>{segundosRestantes}s</Text>
        </View>

        <Card style={styles.valorCard}>
          <Text style={styles.valorLabel}>Valor estimado</Text>
          <Text style={styles.valor}>R$ {Number(ofertaCorrida.valorCorrida).toFixed(2)}</Text>
          <Text style={styles.distancia}>{ofertaCorrida.distanciaKm.toFixed(1)} km</Text>
        </Card>

        <Card style={styles.enderecoCard}>
          <Text style={styles.enderecoLabel}>Coleta</Text>
          <Text style={styles.enderecoTexto}>{ofertaCorrida.enderecoColeta}</Text>
        </Card>

        <Card style={styles.enderecoCard}>
          <Text style={styles.enderecoLabel}>Entrega</Text>
          <Text style={styles.enderecoTexto}>{ofertaCorrida.enderecoEntrega}</Text>
        </Card>

        <View style={styles.actions}>
          <Button label="Recusar" variant="outline" onPress={recusarOferta} disabled={processando} style={styles.flexButton} />
          <Button label="Aceitar" variant="primary" onPress={handleAceitar} loading={processando} style={styles.flexButton} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    justifyContent: 'flex-end',
  },
  header: {
    position: 'absolute',
    top: theme.spacing.xxl,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 22,
    color: theme.colors.accent,
  },
  timer: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    color: theme.colors.primary,
  },
  valorCard: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  valorLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  valor: {
    fontFamily: theme.fonts.heading,
    fontSize: 36,
    color: theme.colors.success,
    marginTop: 4,
  },
  distancia: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  enderecoCard: {
    marginBottom: theme.spacing.md,
  },
  enderecoLabel: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 12,
    color: theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  enderecoTexto: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  flexButton: {
    flex: 1,
  },
});
