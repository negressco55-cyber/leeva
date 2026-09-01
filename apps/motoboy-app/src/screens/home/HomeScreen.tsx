import { type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useRide } from '../../context/RideContext';
import type { AppStackParamList, MainTabParamList } from '../../navigation/types';
import { theme } from '../../theme/theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function HomeScreen(_props: Props): React.JSX.Element {
  const { motoboy } = useAuth();
  const { disponivel, alternandoDisponibilidade, ligarDisponibilidade, desligarDisponibilidade, corridaAtiva } =
    useRide();
  const rootNavigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  useEffect(() => {
    if (corridaAtiva && corridaAtiva.status !== 'ENTREGUE') {
      rootNavigation.navigate('CorridaAndamento');
    }
  }, [corridaAtiva, rootNavigation]);

  const statusAprovacao = motoboy?.statusAprovacao ?? 'PENDENTE';
  const podeFicarDisponivel = statusAprovacao === 'APROVADO';

  function handleToggle(valor: boolean): void {
    if (valor) {
      void ligarDisponibilidade();
    } else {
      void desligarDisponibilidade();
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.greeting}>Olá, {motoboy?.nomeCompleto?.split(' ')[0] ?? 'motoboy'}</Text>

      {!podeFicarDisponivel && (
        <Card style={styles.warningCard}>
          <Text style={styles.warningTitle}>
            {statusAprovacao === 'PENDENTE' && 'Cadastro em análise'}
            {statusAprovacao === 'REJEITADO' && 'Cadastro reprovado'}
            {statusAprovacao === 'BLOQUEADO' && 'Cadastro bloqueado'}
          </Text>
          <Text style={styles.warningText}>
            {statusAprovacao === 'PENDENTE' &&
              'Estamos analisando seus documentos. Assim que aprovado, você poderá ficar disponível para corridas.'}
            {statusAprovacao === 'REJEITADO' &&
              'Seu cadastro não foi aprovado. Entre em contato com o suporte para mais informações.'}
            {statusAprovacao === 'BLOQUEADO' &&
              'Sua conta está bloqueada. Entre em contato com o suporte para regularizar.'}
          </Text>
        </Card>
      )}

      <Card style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>{disponivel ? 'Disponível' : 'Indisponível'}</Text>
            <Text style={styles.statusHint}>
              {disponivel ? 'Recebendo corridas na sua região' : 'Ative para começar a receber corridas'}
            </Text>
          </View>
          <Switch
            value={disponivel}
            onValueChange={handleToggle}
            disabled={!podeFicarDisponivel || alternandoDisponibilidade}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor={disponivel ? theme.colors.primary : theme.colors.textSecondary}
          />
        </View>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{motoboy?.notaMedia?.toFixed(1) ?? '—'}</Text>
          <Text style={styles.statLabel}>Nota média</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{motoboy?.totalCorridas ?? 0}</Text>
          <Text style={styles.statLabel}>Corridas feitas</Text>
        </Card>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: {
    fontFamily: theme.fonts.heading,
    fontSize: 26,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  warningCard: {
    borderColor: theme.colors.accent,
    marginBottom: theme.spacing.md,
  },
  warningTitle: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.accent,
    fontSize: 15,
    marginBottom: 4,
  },
  warningText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  statusCard: {
    marginBottom: theme.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 20,
    color: theme.colors.text,
  },
  statusHint: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    maxWidth: 220,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: theme.fonts.heading,
    fontSize: 28,
    color: theme.colors.primary,
  },
  statLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
});
