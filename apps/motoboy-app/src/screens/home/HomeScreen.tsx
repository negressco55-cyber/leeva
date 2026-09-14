import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bike } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { LiveMapMini } from '../../components/LiveMapMini';
import { SearchRadar } from '../../components/SearchRadar';
import { useAuth } from '../../context/AuthContext';
import { useRide } from '../../context/RideContext';
import type { AppStackParamList } from '../../navigation/types';
import { theme } from '../../theme/theme';

export function HomeScreen(): React.JSX.Element {
  const { me, refreshMe } = useAuth();
  const { online, togglingOnline, goOnline, goOffline, activeDelivery } = useRide();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    if (activeDelivery && activeDelivery.status !== 'delivered') {
      nav.navigate('Entrega');
    }
  }, [activeDelivery, nav]);

  const approval = me?.approvalStatus ?? 'pending_approval';
  const podeFicarOnline = approval === 'approved' && !me?.terms;

  async function onRefresh(): Promise<void> {
    setRefreshing(true);
    await refreshMe();
    setRefreshing(false);
  }

  async function handleToggle(): Promise<void> {
    if (!podeFicarOnline || togglingOnline) return;
    if (online) await goOffline();
    else await goOnline();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <View style={styles.header}>
          <Avatar name={me?.fullName ?? 'Entregador'} src={me?.avatarUrl} size={38} />
          <Text style={styles.headerName} numberOfLines={1}>
            {me?.fullName ?? 'Entregador'}
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.mapBackdrop} pointerEvents="none">
            <LiveMapMini />
            <View style={styles.mapScrim} />
          </View>

          <View style={styles.statusContent}>
            {online ? (
              <>
                <SearchRadar size={188} />
                <Text style={styles.statusTitle}>Procurando entregas</Text>
                <Text style={styles.statusSubtitle}>Você está disponível — assim que surgir um pedido perto, a gente te avisa.</Text>
              </>
            ) : (
              <>
                <View style={styles.idleIcon}>
                  <Bike size={30} color={theme.colors.textSecondary} strokeWidth={2} />
                </View>
                <Text style={styles.statusTitle}>Você está indisponível</Text>
                <Text style={styles.statusSubtitle}>
                  {podeFicarOnline
                    ? 'Toque no botão abaixo para começar a receber entregas.'
                    : approval === 'pending_approval'
                      ? 'Seu cadastro ainda está em análise.'
                      : approval === 'rejected'
                        ? (me?.approvalReason ?? 'Cadastro não aprovado — fale com o suporte.')
                        : 'Aceite os termos de uso na aba Perfil para poder ficar disponível.'}
                </Text>
              </>
            )}
          </View>

          <Pressable
            onPress={() => void handleToggle()}
            disabled={!podeFicarOnline || togglingOnline}
            style={({ pressed }) => [
              styles.toggle,
              online ? styles.toggleOn : styles.toggleOff,
              (!podeFicarOnline || togglingOnline) && styles.toggleDisabled,
              pressed && styles.togglePressed,
            ]}
          >
            {togglingOnline ? (
              <ActivityIndicator size="small" color={online ? theme.colors.onPrimary : theme.colors.text} />
            ) : (
              <Text style={[styles.toggleLabel, online ? styles.toggleLabelOn : styles.toggleLabelOff]}>
                {online ? 'Ficar indisponível' : 'Ficar disponível'}
              </Text>
            )}
          </Pressable>
        </View>

        {approval !== 'approved' && (
          <Card style={styles.warnCard}>
            <Text style={styles.warnTitle}>
              {approval === 'pending_approval' ? 'Cadastro em análise' : 'Cadastro não aprovado'}
            </Text>
            <Text style={styles.warnText}>
              {approval === 'pending_approval'
                ? 'Estamos conferindo seus documentos. Assim que for aprovado você poderá ficar disponível.'
                : (me?.approvalReason ?? 'Fale com o suporte para regularizar seu cadastro.')}
            </Text>
          </Card>
        )}

        {approval === 'approved' && me?.terms && (
          <Card style={styles.warnCard}>
            <Text style={styles.warnTitle}>Aceite os termos de uso</Text>
            <Text style={styles.warnText}>Abra a aba Perfil e aceite os termos de uso para poder ficar disponível.</Text>
          </Card>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{me?.rating != null ? me.rating.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Nota média</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{me?.deliveriesCompleted ?? 0}</Text>
            <Text style={styles.statLabel}>Entregas feitas</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },

  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  headerName: { fontFamily: theme.fonts.headingSemiBold, fontSize: 16, color: theme.colors.text, flexShrink: 1 },

  statusCard: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 440,
  },
  mapBackdrop: { ...StyleSheet.absoluteFill },
  mapScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.background,
    opacity: 0.82,
  },
  statusContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  idleIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  statusTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  statusSubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
  },

  toggle: {
    margin: theme.spacing.md,
    minHeight: 54,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.borderStrong },
  toggleOff: { backgroundColor: theme.colors.primary },
  toggleDisabled: { opacity: 0.45 },
  togglePressed: { opacity: 0.85 },
  toggleLabel: { fontFamily: theme.fonts.bodySemiBold, fontSize: 16 },
  toggleLabelOn: { color: theme.colors.text },
  toggleLabelOff: { color: theme.colors.onPrimary },

  warnCard: { borderColor: theme.colors.accent },
  warnTitle: { fontFamily: theme.fonts.bodySemiBold, color: theme.colors.accent, fontSize: 15, marginBottom: 4 },
  warnText: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  statItem: { alignItems: 'flex-start' },
  statValue: { fontFamily: theme.fonts.headingSemiBold, fontSize: 17, color: theme.colors.text },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: theme.colors.border },
});
