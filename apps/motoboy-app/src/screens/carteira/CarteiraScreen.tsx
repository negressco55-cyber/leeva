import { CheckCircle2, Clock, Wallet, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWallet, requestPayout, type PayoutHistoryEntry, type WalletInfo } from '../../api/motoboy';
import { Button } from '../../components/Button';
import { theme } from '../../theme/theme';

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  processing: 'Processando',
  paid: 'Pago',
  failed: 'Falhou',
  awaiting_pix: 'Falta chave Pix',
};

function data(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function HistoryItem({ item }: { item: PayoutHistoryEntry }): React.JSX.Element {
  const ok = item.status === 'paid';
  const failed = item.status === 'failed' || item.status === 'awaiting_pix';
  return (
    <View style={styles.item}>
      <View style={[styles.itemIcon, ok ? styles.itemIconOk : failed ? styles.itemIconFail : styles.itemIconPending]}>
        {ok ? (
          <CheckCircle2 size={18} color={theme.colors.success} strokeWidth={2} />
        ) : failed ? (
          <XCircle size={18} color={theme.colors.danger} strokeWidth={2} />
        ) : (
          <Clock size={18} color={theme.colors.accent} strokeWidth={2} />
        )}
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>
          {data(item.periodDate)} <Text style={styles.itemMeta}>· {item.earningsCount} entrega{item.earningsCount === 1 ? '' : 's'}</Text>
        </Text>
        <Text style={styles.itemMeta}>
          {STATUS_LABEL[item.status] ?? item.status}
          {item.simulated ? ' (simulação)' : ''}
          {item.error ? ` — ${item.error}` : ''}
        </Text>
      </View>
      <Text style={[styles.itemValor, !ok && styles.itemValorMuted]}>{brl(item.netAmount)}</Text>
    </View>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>Nenhum repasse ainda.</Text>
    </View>
  );
}

export function CarteiraScreen(): React.JSX.Element {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setWallet(await getWallet());
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

  async function onRequestPayout(): Promise<void> {
    setRequesting(true);
    try {
      const r = await requestPayout();
      if (!r.ok) {
        Alert.alert('Não deu pra solicitar', r.error);
        return;
      }
      Alert.alert('Pronto', `Repasse de ${brl(r.netAmount)} enviado para sua chave Pix${r.fee > 0 ? ` (taxa de ${brl(r.fee)} descontada)` : ''}.`);
      await load();
    } catch (e) {
      Alert.alert('Erro', (e as Error).message || 'Tente de novo.');
    } finally {
      setRequesting(false);
    }
  }

  if (loading || !wallet) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.title}>Carteira</Text>

        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>SALDO DISPONÍVEL</Text>
            <View style={styles.balanceIcon}>
              <Wallet size={16} color={theme.colors.primary} strokeWidth={2} />
            </View>
          </View>
          <Text style={styles.balanceValor}>{brl(wallet.pendingAmount)}</Text>
          <Text style={styles.feeHint}>
            {wallet.pendingCount} entrega{wallet.pendingCount === 1 ? '' : 's'} pronta{wallet.pendingCount === 1 ? '' : 's'} pra saque. Peça quando quiser — até uma vez por dia.
          </Text>
          <Text style={styles.feeHint}>
            O banco cobra {brl(wallet.transferFee)} por transferência Pix, descontado do valor sacado.
          </Text>
          <Button
            label={requesting ? 'Solicitando…' : 'Solicitar repasse'}
            onPress={() => void onRequestPayout()}
            loading={requesting}
            disabled={wallet.pendingAmount <= 0 || wallet.requestedToday}
            style={{ marginTop: theme.spacing.sm }}
          />
          {wallet.requestedToday && (
            <Text style={[styles.feeHint, { marginTop: 6 }]}>Você já solicitou um repasse hoje. Tente de novo amanhã.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>REPASSES</Text>
        <FlatList
          data={wallet.history}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => <HistoryItem item={item} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1, padding: theme.spacing.lg },
  title: { fontFamily: theme.fonts.heading, fontSize: 26, color: theme.colors.text, marginBottom: theme.spacing.md },

  balanceCard: {
    backgroundColor: theme.colors.primaryWeak,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { fontFamily: theme.fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.2, color: theme.colors.textSecondary },
  balanceIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  balanceValor: { fontFamily: theme.fonts.heading, fontSize: 40, color: theme.colors.text, marginTop: 6, marginBottom: 6, letterSpacing: -1 },
  feeHint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  sectionTitle: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  itemIconOk: { backgroundColor: 'rgba(85,196,127,0.12)' },
  itemIconFail: { backgroundColor: 'rgba(228,106,97,0.12)' },
  itemIconPending: { backgroundColor: 'rgba(214,169,81,0.12)' },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: { fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.text },
  itemMeta: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  itemValor: { fontFamily: theme.fonts.bodySemiBold, fontSize: 15, color: theme.colors.success },
  itemValorMuted: { color: theme.colors.textSecondary },

  empty: { alignItems: 'center', marginTop: theme.spacing.xl },
  emptyText: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary },
});
