import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme/theme';

const LABEL_STATUS_APROVACAO: Record<string, string> = {
  PENDENTE: 'Em análise',
  APROVADO: 'Aprovado',
  REJEITADO: 'Reprovado',
  BLOQUEADO: 'Bloqueado',
};

export function PerfilScreen(): React.JSX.Element {
  const { user, motoboy, logout } = useAuth();

  return (
    <ScreenContainer>
      <Text style={styles.title}>Perfil</Text>

      <Card style={styles.card}>
        <Text style={styles.nome}>{motoboy?.nomeCompleto ?? '—'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.telefone}>{user?.telefone}</Text>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{motoboy?.notaMedia?.toFixed(1) ?? '—'}</Text>
          <Text style={styles.statLabel}>Nota média</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{motoboy?.totalCorridas ?? 0}</Text>
          <Text style={styles.statLabel}>Corridas</Text>
        </Card>
      </View>

      <Card style={styles.card}>
        <Text style={styles.infoLabel}>Placa do veículo</Text>
        <Text style={styles.infoValor}>{motoboy?.placaVeiculo ?? '—'}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.infoLabel}>Status do cadastro</Text>
        <Text style={styles.infoValor}>
          {motoboy ? LABEL_STATUS_APROVACAO[motoboy.statusAprovacao] ?? motoboy.statusAprovacao : '—'}
        </Text>
      </Card>

      <Button label="Sair" variant="danger" onPress={() => void logout()} style={styles.logoutButton} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 26,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  nome: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 20,
    color: theme.colors.text,
  },
  email: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  telefone: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: theme.fonts.heading,
    fontSize: 26,
    color: theme.colors.primary,
  },
  statLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  infoLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValor: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: 4,
  },
  logoutButton: {
    marginTop: theme.spacing.lg,
  },
});
