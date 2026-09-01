import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { getHistoricoCorridas } from '../../api/corridas';
import { Card } from '../../components/Card';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatusBadge } from '../../components/StatusBadge';
import { theme } from '../../theme/theme';
import type { Corrida } from '../../types';

function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function CorridaHistoricoItem({ corrida }: { corrida: Corrida }): React.JSX.Element {
  return (
    <Card style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemData}>{formatarData(corrida.entregueEm ?? corrida.criadoEm)}</Text>
        <StatusBadge status={corrida.status} />
      </View>
      <Text style={styles.itemEndereco} numberOfLines={1}>
        {corrida.enderecoColeta}
      </Text>
      <Text style={styles.itemEndereco} numberOfLines={1}>
        → {corrida.enderecoEntrega}
      </Text>
      <Text style={styles.itemValor}>R$ {Number(corrida.valorCorrida).toFixed(2)}</Text>
    </Card>
  );
}

export function HistoricoScreen(): React.JSX.Element {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [totalGanho, setTotalGanho] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    const response = await getHistoricoCorridas(1);
    setCorridas(response.items);
    setTotalGanho(Number(response.ganhosTotais));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await carregar();
      } finally {
        setLoading(false);
      }
    })();
  }, [carregar]);

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      await carregar();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Ganhos</Text>

      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total ganho</Text>
        <Text style={styles.totalValor}>R$ {totalGanho.toFixed(2)}</Text>
        <Text style={styles.totalHint}>{corridas.length} corrida(s) concluída(s)</Text>
      </Card>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={styles.loading} />
      ) : (
        <FlatList
          data={corridas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CorridaHistoricoItem corrida={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma corrida concluída ainda.</Text>}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 26,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  totalCard: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  totalLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  totalValor: {
    fontFamily: theme.fonts.heading,
    fontSize: 34,
    color: theme.colors.success,
    marginTop: 4,
  },
  totalHint: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  listContent: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  item: {
    marginBottom: theme.spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  itemData: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  itemEndereco: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.text,
  },
  itemValor: {
    fontFamily: theme.fonts.headingSemiBold,
    fontSize: 18,
    color: theme.colors.primary,
    marginTop: theme.spacing.sm,
  },
  loading: {
    marginTop: theme.spacing.xl,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});
