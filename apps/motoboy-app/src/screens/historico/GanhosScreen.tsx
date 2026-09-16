import { CheckCircle2, Inbox, Wallet, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHistorico } from '../../api/entregas';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/theme';
import type { HistoricoItem } from '../../types';

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

function data(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function EmptyState(): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Inbox size={36} color={t.colors.textSecondary} strokeWidth={1.6} />
      </View>
      <Text style={styles.emptyTitle}>Nenhuma entrega ainda</Text>
      <Text style={styles.emptyText}>Assim que você concluir uma entrega, ela aparece aqui.</Text>
    </View>
  );
}

function Item({ item }: { item: HistoricoItem }): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const delivered = item.status === 'delivered';
  return (
    <View style={styles.item}>
      <View style={[styles.itemIcon, delivered ? styles.itemIconOk : styles.itemIconCancel]}>
        {delivered ? (
          <CheckCircle2 size={18} color={t.colors.success} strokeWidth={2} />
        ) : (
          <XCircle size={18} color={t.colors.danger} strokeWidth={2} />
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
  const t = useTheme();
  const styles = makeStyles(t);
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
              <Wallet size={16} color={t.colors.primary} strokeWidth={2} />
            </View>
          </View>
          <Text style={styles.heroValor}>{brl(total)}</Text>
          <Text style={styles.heroHint}>{count} entrega{count === 1 ? '' : 's'} concluída{count === 1 ? '' : 's'}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={t.colors.primary} style={{ marginTop: t.spacing.xl }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: t.spacing.xl }}
            initialNumToRender={8}
            windowSize={7}
            removeClippedSubviews
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.primary} />}
            ListEmptyComponent={<EmptyState />}
            renderItem={({ item }) => <Item item={item} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    content: { flex: 1, padding: t.spacing.lg },
    title: { fontFamily: t.fonts.heading, fontSize: 26, color: t.colors.text, marginBottom: t.spacing.md },

    heroCard: {
      backgroundColor: t.colors.primaryWeak,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
      marginBottom: t.spacing.md,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroLabel: {
      fontFamily: t.fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.2,
      color: t.colors.textSecondary,
    },
    heroIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroValor: {
      fontFamily: t.fonts.heading,
      fontSize: 44,
      color: t.colors.text,
      marginTop: 6,
      letterSpacing: -1,
    },
    heroHint: { fontFamily: t.fonts.body, fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },

    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
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
    itemTitle: { fontFamily: t.fonts.bodySemiBold, fontSize: 14, color: t.colors.text },
    itemDate: { fontFamily: t.fonts.body, fontSize: 12, color: t.colors.textSecondary },
    itemAddress: { fontFamily: t.fonts.body, fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    itemValor: { fontFamily: t.fonts.bodySemiBold, fontSize: 15, color: t.colors.success },
    itemValorMuted: { color: t.colors.textSecondary },

    empty: { alignItems: 'center', marginTop: t.spacing.xxl, paddingHorizontal: t.spacing.xl },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.md,
    },
    emptyTitle: { fontFamily: t.fonts.bodySemiBold, fontSize: 16, color: t.colors.text },
    emptyText: {
      fontFamily: t.fonts.body,
      fontSize: 13,
      color: t.colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
  });
}
