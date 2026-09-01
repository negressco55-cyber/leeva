import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Linking, Modal, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { MapaCorrida } from '../../components/MapaCorrida';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatusBadge } from '../../components/StatusBadge';
import { useRide } from '../../context/RideContext';
import type { AppStackParamList } from '../../navigation/types';
import { theme } from '../../theme/theme';
import type { StatusCorrida } from '../../types';

type Props = NativeStackScreenProps<AppStackParamList, 'CorridaAndamento'>;

const LABEL_PROXIMA_ACAO: Partial<Record<StatusCorrida, string>> = {
  ACEITA: 'Iniciar ida até a coleta',
  A_CAMINHO_COLETA: 'Confirmar coleta',
  COLETADO: 'Iniciar ida até a entrega',
  A_CAMINHO_ENTREGA: 'Confirmar entrega',
};

function destinoAtual(status: StatusCorrida): 'coleta' | 'entrega' {
  return status === 'ACEITA' || status === 'A_CAMINHO_COLETA' ? 'coleta' : 'entrega';
}

export function CorridaAndamentoScreen({ navigation }: Props): React.JSX.Element {
  const { corridaAtiva, atualizandoStatus, avancarStatusCorrida, finalizarCorridaAtiva, posicaoAtual } = useRide();
  const [modalCodigoAberto, setModalCodigoAberto] = useState(false);
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [erroCodigo, setErroCodigo] = useState<string | null>(null);

  if (!corridaAtiva) {
    return (
      <ScreenContainer>
        <Text style={styles.emptyText}>Nenhuma corrida em andamento.</Text>
        <Button label="Voltar" onPress={() => navigation.goBack()} style={styles.emptyButton} />
      </ScreenContainer>
    );
  }

  const destino = destinoAtual(corridaAtiva.status);
  const lat = destino === 'coleta' ? corridaAtiva.latColeta : corridaAtiva.latEntrega;
  const lng = destino === 'coleta' ? corridaAtiva.lngColeta : corridaAtiva.lngEntrega;
  const endereco = destino === 'coleta' ? corridaAtiva.enderecoColeta : corridaAtiva.enderecoEntrega;
  const proximaAcaoLabel = LABEL_PROXIMA_ACAO[corridaAtiva.status];
  const entregue = corridaAtiva.status === 'ENTREGUE';

  function handleAbrirMapa(): void {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    void Linking.openURL(url);
  }

  function handleFinalizar(): void {
    finalizarCorridaAtiva();
    navigation.goBack();
  }

  function handleProximaAcao(): void {
    if (!corridaAtiva) return;
    if (corridaAtiva.status === 'A_CAMINHO_ENTREGA') {
      setErroCodigo(null);
      setCodigoDigitado('');
      setModalCodigoAberto(true);
      return;
    }
    void avancarStatusCorrida();
  }

  async function handleConfirmarEntrega(): Promise<void> {
    if (codigoDigitado.trim().length !== 4) {
      setErroCodigo('Digite os 4 dígitos que o destinatário informou.');
      return;
    }
    setErroCodigo(null);
    try {
      await avancarStatusCorrida(codigoDigitado.trim());
      setModalCodigoAberto(false);
    } catch (error) {
      setErroCodigo(error instanceof Error ? error.message : 'Código incorreto. Confira com o destinatário.');
    }
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>{entregue ? 'Entrega concluída' : 'Corrida em andamento'}</Text>
      <StatusBadge status={corridaAtiva.status} />

      <Card style={styles.valorCard}>
        <Text style={styles.valorLabel}>Valor da corrida</Text>
        <Text style={styles.valor}>R$ {Number(corridaAtiva.valorCorrida).toFixed(2)}</Text>
        {corridaAtiva.distanciaKm != null && (
          <Text style={styles.distancia}>{corridaAtiva.distanciaKm.toFixed(1)} km</Text>
        )}
      </Card>

      <Card style={styles.enderecoCard}>
        <Text style={styles.enderecoLabel}>Coleta</Text>
        <Text style={styles.enderecoTexto}>{corridaAtiva.enderecoColeta}</Text>
      </Card>

      <Card style={styles.enderecoCard}>
        <Text style={styles.enderecoLabel}>Entrega</Text>
        <Text style={styles.enderecoTexto}>{corridaAtiva.enderecoEntrega}</Text>
        {corridaAtiva.nomeDestinatario && (
          <Text style={styles.destinatario}>
            {corridaAtiva.nomeDestinatario}
            {corridaAtiva.telefoneDestinatario ? ` · ${corridaAtiva.telefoneDestinatario}` : ''}
          </Text>
        )}
      </Card>

      {corridaAtiva.observacoes ? (
        <Card style={styles.enderecoCard}>
          <Text style={styles.enderecoLabel}>Observações</Text>
          <Text style={styles.enderecoTexto}>{corridaAtiva.observacoes}</Text>
        </Card>
      ) : null}

      <MapaCorrida
        latColeta={corridaAtiva.latColeta}
        lngColeta={corridaAtiva.lngColeta}
        latEntrega={corridaAtiva.latEntrega}
        lngEntrega={corridaAtiva.lngEntrega}
        motoboyLat={posicaoAtual?.latitude}
        motoboyLng={posicaoAtual?.longitude}
        rotaGeometria={corridaAtiva.rotaGeometria}
        style={styles.mapa}
      />

      <View style={styles.actions}>
        {!entregue && (
          <Button
            label={`Abrir no mapa (${destino === 'coleta' ? 'coleta' : 'entrega'})`}
            variant="outline"
            onPress={handleAbrirMapa}
          />
        )}

        {!entregue && proximaAcaoLabel && (
          <Button
            label={proximaAcaoLabel}
            onPress={handleProximaAcao}
            loading={atualizandoStatus}
            style={styles.primaryAction}
          />
        )}

        {entregue && <Button label="Concluir" variant="primary" onPress={handleFinalizar} style={styles.primaryAction} />}
      </View>

      <Modal visible={modalCodigoAberto} transparent animationType="fade" onRequestClose={() => setModalCodigoAberto(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Código de confirmação</Text>
            <Text style={styles.modalTexto}>
              Peça pro destinatário informar o código de 4 dígitos que ele recebeu — sem isso a
              entrega não é confirmada.
            </Text>
            <TextInput
              value={codigoDigitado}
              onChangeText={(v) => setCodigoDigitado(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={theme.colors.textSecondary}
              style={styles.modalInput}
              autoFocus
            />
            {erroCodigo && <Text style={styles.modalErro}>{erroCodigo}</Text>}
            <View style={styles.modalAcoes}>
              <Button label="Cancelar" variant="outline" onPress={() => setModalCodigoAberto(false)} style={styles.modalBotao} />
              <Button
                label="Confirmar"
                onPress={() => void handleConfirmarEntrega()}
                loading={atualizandoStatus}
                style={styles.modalBotao}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 24,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  valorCard: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  valorLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  valor: {
    fontFamily: theme.fonts.heading,
    fontSize: 32,
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
  mapa: {
    height: 240,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  destinatario: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  actions: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  primaryAction: {
    marginTop: theme.spacing.xs,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xxl,
  },
  emptyButton: {
    marginTop: theme.spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
  },
  modalTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 20,
    color: theme.colors.text,
  },
  modalTexto: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    lineHeight: 18,
  },
  modalInput: {
    fontFamily: theme.fonts.heading,
    fontSize: 32,
    letterSpacing: 12,
    textAlign: 'center',
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  modalErro: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.danger,
    marginTop: theme.spacing.sm,
  },
  modalAcoes: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  modalBotao: {
    flex: 1,
  },
});
