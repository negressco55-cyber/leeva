import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { LiveMapMini } from '../../components/LiveMapMini';
import { useAuth } from '../../context/AuthContext';
import { useRide } from '../../context/RideContext';
import type { AppStackParamList } from '../../navigation/types';
import { theme } from '../../theme/theme';

export function HomeScreen(): React.JSX.Element {
  const { me, refreshMe } = useAuth();
  const { online, togglingOnline, goOnline, goOffline, activeDelivery } = useRide();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
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

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {/* mapa cheio, sangrando até embaixo da barra de status */}
      <View style={styles.mapWrap}>
        <LiveMapMini />

        <View style={[styles.topbar, { paddingTop: insets.top + theme.spacing.sm }]}>
          <Avatar name={me?.fullName ?? 'Entregador'} src={me?.avatarUrl} size={40} />
          <Pressable
            onPress={() => (online ? void goOffline() : void goOnline())}
            disabled={!podeFicarOnline || togglingOnline}
            style={({ pressed }) => [styles.pill, online ? styles.pillOn : styles.pillOff, pressed && styles.pillPressed]}
          >
            {togglingOnline ? (
              <ActivityIndicator size="small" color={online ? theme.colors.onPrimary : theme.colors.text} />
            ) : (
              <Text style={styles.pillGlyph}>🛵</Text>
            )}
            <Text style={[styles.pillLabel, online ? styles.pillLabelOn : styles.pillLabelOff]}>
              {togglingOnline ? 'Um instante…' : online ? 'Disponível' : 'Indisponível'}
            </Text>
          </Pressable>
          <View style={styles.topbarSpacer} />
        </View>

        <View style={online ? styles.banner : styles.bannerHint}>
          <Text style={online ? styles.bannerText : styles.bannerHintText}>
            {online ? '🔎  Procurando entregas para você' : 'Toque no botão acima para ficar disponível'}
          </Text>
        </View>
      </View>

      {/* folha inferior — só o que é real */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
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
            <Text style={styles.warnText}>
              Abra a aba Perfil e aceite os termos de uso para poder ficar disponível.
            </Text>
          </Card>
        )}

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{me?.rating != null ? me.rating.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Nota média</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{me?.deliveriesCompleted ?? 0}</Text>
            <Text style={styles.statLabel}>Entregas feitas</Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },

  // o mapa ocupa TODO o espaço que sobra (a folha de baixo só pega o que precisa)
  mapWrap: { flex: 1, position: 'relative' },

  topbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  topbarSpacer: { width: 40 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pillOn: { backgroundColor: theme.colors.primary },
  pillOff: { backgroundColor: '#fff' },
  pillPressed: { opacity: 0.85 },
  pillGlyph: { fontSize: 16 },
  pillLabel: { fontFamily: theme.fonts.bodySemiBold, fontSize: 15 },
  pillLabelOn: { color: theme.colors.onPrimary },
  pillLabelOff: { color: '#14140e' },

  banner: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  bannerText: { fontFamily: theme.fonts.bodySemiBold, fontSize: 13, color: '#14140e', textAlign: 'center' },
  bannerHint: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  bannerHintText: { fontFamily: theme.fonts.bodyMedium, fontSize: 13, color: '#14140e', textAlign: 'center' },

  sheet: { flexGrow: 0, flexShrink: 0, maxHeight: '42%' },
  sheetContent: { padding: theme.spacing.lg, paddingTop: theme.spacing.md },

  warnCard: { borderColor: theme.colors.accent, marginBottom: theme.spacing.md },
  warnTitle: { fontFamily: theme.fonts.bodySemiBold, color: theme.colors.accent, fontSize: 15, marginBottom: 4 },
  warnText: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },

  statsRow: { flexDirection: 'row', gap: theme.spacing.md },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: theme.fonts.heading, fontSize: 28, color: theme.colors.primary },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
});
