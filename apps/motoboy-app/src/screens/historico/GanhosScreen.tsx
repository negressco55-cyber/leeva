import { CheckCircle2, Inbox, Wallet, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHistorico } from '../../api/entregas';
import { theme } from '../../theme/theme';
import type { HistoricoItem } from '../../types';

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

function data(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function EmptyState(): React.JSX.Element {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Inbox size={36} color={theme.colors.textSecondary} strokeWidth={1.6} />
      </View>
      <Text style={styles.emptyTitle}>Nenhuma entrega ainda</Text>
      <Text style={styles.emptyText}>Assim que você concluir uma entrega, ela aparece aqui.</Text>
    </View>
  );
}

function Item({ item }: { item: HistoricoItem }): React.JSX.Element {
  const delivered = item.status === 'delivered';
  return (
    <View style={styles.item}>
      <View style={[styles.itemIcon, delivered ? styles.itemIconOk : styles.itemIconCancel]}>
        {delivered ? (
          <CheckCircle2 size={18} color={theme.colors.success} strokeWidth={2} />
        ) : (
          <XCircle size={18} color={theme.colors.danger} strokeWidth={2} />
        )}
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>
          Pedido #{item.orderNumber ?? '—'} <Text style={styles.itemDate}>· {data(item.finishedAt ?? item.createdAt)}</Text>
        </Text>
        <Text style={styles.itemAddress} numberOfLines={1}>
          {item.address}
        </Text>
      </View>
      <Text style={[styles.itemValor, !delivered && styles.itemValorMuted]}>{delivered ? brl(item.payout) : '—'}</Text>
    </View>
  );
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

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>TOTAL RECEBIDO</Text>
            <View style={styles.heroIcon}>
              <Wallet size={16} color={theme.colors.primary} strokeWidth={2} />
            </View>
          </View>
          <Text style={styles.heroValor}>{brl(total)}</Text>
          <Text style={styles.heroHint}>{count} entrega{count === 1 ? '' : 's'} concluída{count === 1 ? '' : 's'}</Text>
        </View>

        <Text style={styles.feeHint}>
          O repasse é 1x por dia via Pix. O banco cobra R$ 1,99 por saque, descontado do valor.
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
            initialNumToRender={8}
            windowSize={7}
            removeClippedSubviews
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
            ListEmptyComponent={<EmptyState />}
            renderItem={({ item }) => <Item item={item} />}
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

  heroCard: {
    backgroundColor: theme.colors.primaryWeak,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: theme.colors.textSecondary,
  },
  heroIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValor: {
    fontFamily: theme.fonts.heading,
    fontSize: 44,
    color: theme.colors.text,
    marginTop: 6,
    letterSpacing: -1,
  },
  heroHint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  feeHint: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconOk: { backgroundColor: 'rgba(85,196,127,0.12)' },
  itemIconCancel: { backgroundColor: 'rgba(228,106,97,0.12)' },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: { fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.text },
  itemDate: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  itemAddress: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  itemValor: { fontFamily: theme.fonts.bodySemiBold, fontSize: 15, color: theme.colors.success },
  itemValorMuted: { color: theme.colors.textSecondary },

  empty: { alignItems: 'center', marginTop: theme.spacing.xxl, paddingHorizontal: theme.spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: { fontFamily: theme.fonts.bodySemiBold, fontSize: 16, color: theme.colors.text },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
