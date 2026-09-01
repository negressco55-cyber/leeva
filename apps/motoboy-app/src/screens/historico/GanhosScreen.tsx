import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHistorico } from '../../api/entregas';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { theme } from '../../theme/theme';
import type { HistoricoItem } from '../../types';

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

function data(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function GanhosScreen(): React.JSX.Element {
  const [items, setItems] = useState<HistoricoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await getHistorico();
    setItems(r.items);
    setTotal(r.totalEarned);
    setCount(r.deliveredCount);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch {
        /* ignora */
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function onRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      await load();
    } catch {
      /* ignora */
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.title}>Ganhos</Text>
        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total recebido</Text>
          <Text style={styles.totalValor}>{brl(total)}</Text>
          <Text style={styles.totalHint}>{count} entrega(s) concluída(s)</Text>
        </Card>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
            ListEmptyComponent={<Text style={styles.empty}>Nenhuma entrega ainda.</Text>}
            renderItem={({ item }) => (
              <Card style={styles.item}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemData}>
                    #{item.orderNumber ?? '—'} · {data(item.finishedAt ?? item.createdAt)}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.itemEndereco} numberOfLines={1}>
                  {item.address}
                </Text>
                <Text style={styles.itemValor}>{item.status === 'delivered' ? brl(item.payout) : '—'}</Text>
              </Card>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1, padding: theme.spacing.lg },
  title: { fontFamily: theme.fonts.heading, fontSize: 26, color: theme.colors.text, marginBottom: theme.spacing.md },
  totalCard: { alignItems: 'center', marginBottom: theme.spacing.md },
  totalLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  totalValor: { fontFamily: theme.fonts.heading, fontSize: 32, color: theme.colors.success, marginTop: 4 },
  totalHint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  item: { marginBottom: theme.spacing.sm },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemData: { fontFamily: theme.fonts.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  itemEndereco: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text },
  itemValor: { fontFamily: theme.fonts.bodySemiBold, fontSize: 15, color: theme.colors.text, marginTop: 4 },
  empty: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.xl },
});
