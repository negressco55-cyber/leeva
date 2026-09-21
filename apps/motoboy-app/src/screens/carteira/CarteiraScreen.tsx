import { CheckCircle2, Clock, Wallet, XCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWallet, requestPayout, type PayoutHistoryEntry, type WalletInfo } from '../../api/motoboy';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/theme';

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
  const t = useTheme();
  const styles = makeStyles(t);
  const ok = item.status === 'paid';
  const failed = item.status === 'failed' || item.status === 'awaiting_pix';
  return (
    <View style={styles.item}>
      <View style={[styles.itemIcon, ok ? styles.itemIconOk : failed ? styles.itemIconFail : styles.itemIconPending]}>
        {ok ? (
          <CheckCircle2 size={18} color={t.colors.success} strokeWidth={2} />
        ) : failed ? (
          <XCircle size={18} color={t.colors.danger} strokeWidth={2} />
        ) : (
          <Clock size={18} color={t.colors.accent} strokeWidth={2} />
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
  const styles = makeStyles(useTheme());
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>Nenhum repasse ainda.</Text>
    </View>
  );
}

export function CarteiraScreen(): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [amountText, setAmountText] = useState('');

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
    const available = wallet?.pendingAmount ?? 0;
    let amount: number | undefined;
    if (amountText.trim()) {
      amount = Number(amountText.replace(',', '.'));
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
        return;
      }
      if (amount > available + 0.001) {
        Alert.alert('Valor acima do saldo', `Você só tem ${brl(available)} disponível para sacar.`);
        return;
      }
    }
    setRequesting(true);
    try {
      const r = await requestPayout(amount);
      if (!r.ok) {
        Alert.alert('Não deu pra solicitar', r.error);
        return;
      }
      Alert.alert('Pronto', `Repasse de ${brl(r.netAmount)} enviado para sua chave Pix${r.fee > 0 ? ` (taxa de ${brl(r.fee)} descontada)` : ''}.`);
      setAmountText('');
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
        <ActivityIndicator color={t.colors.primary} style={{ marginTop: t.spacing.xxl }} />
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
              <Wallet size={16} color={t.colors.primary} strokeWidth={2} />
            </View>
          </View>
          <Text style={styles.balanceValor}>{brl(wallet.pendingAmount)}</Text>
          <Text style={styles.feeHint}>
            {wallet.pendingCount} entrega{wallet.pendingCount === 1 ? '' : 's'} pronta{wallet.pendingCount === 1 ? '' : 's'} pra saque. Peça quando quiser — até uma vez por dia.
          </Text>
          <Text style={styles.feeHint}>
            O banco cobra {brl(wallet.transferFee)} por transferência Pix, descontado do valor sacado.
          </Text>
          <View style={{ marginTop: t.spacing.sm }}>
            <TextField
              label="Quanto sacar? (vazio = tudo)"
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              placeholder={brl(wallet.pendingAmount)}
            />
          </View>
          <Button
            label={requesting ? 'Solicitando…' : 'Solicitar repasse'}
            onPress={() => void onRequestPayout()}
            loading={requesting}
            disabled={wallet.pendingAmount <= 0 || wallet.requestedToday}
            style={{ marginTop: t.spacing.sm }}
          />
          {wallet.requestedToday && (
            <Text style={[styles.feeHint, { marginTop: 6 }]}>Você já solicitou um repasse hoje. Tente de novo amanhã.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>REPASSES</Text>
        <FlatList
          data={wallet.history}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: t.spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.primary} />}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => <HistoryItem item={item} />}
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    content: { flex: 1, padding: t.spacing.lg },
    title: { fontFamily: t.fonts.heading, fontSize: 26, color: t.colors.text, marginBottom: t.spacing.md },

    balanceCard: {
      backgroundColor: t.colors.primaryWeak,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
      marginBottom: t.spacing.lg,
    },
    balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    balanceLabel: { fontFamily: t.fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.2, color: t.colors.textSecondary },
    balanceIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center' },
    balanceValor: { fontFamily: t.fonts.heading, fontSize: 40, color: t.colors.text, marginTop: 6, marginBottom: 6, letterSpacing: -1 },
    feeHint: { fontFamily: t.fonts.body, fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },

    sectionTitle: {
      fontFamily: t.fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.1,
      color: t.colors.textSecondary,
      marginBottom: t.spacing.sm,
    },

    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    itemIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    itemIconOk: { backgroundColor: 'rgba(85,196,127,0.12)' },
    itemIconFail: { backgroundColor: 'rgba(228,106,97,0.12)' },
    itemIconPending: { backgroundColor: 'rgba(214,169,81,0.12)' },
    itemBody: { flex: 1, minWidth: 0 },
    itemTitle: { fontFamily: t.fonts.bodySemiBold, fontSize: 14, color: t.colors.text },
    itemMeta: { fontFamily: t.fonts.body, fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    itemValor: { fontFamily: t.fonts.bodySemiBold, fontSize: 15, color: t.colors.success },
    itemValorMuted: { color: t.colors.textSecondary },

    empty: { alignItems: 'center', marginTop: t.spacing.xl },
    emptyText: { fontFamily: t.fonts.body, color: t.colors.textSecondary },
  });
}
