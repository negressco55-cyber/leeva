import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../../components/Card';
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <Text style={styles.greeting}>Olá, {me?.fullName?.split(' ')[0] ?? 'entregador'}</Text>

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

        <Pressable
          onPress={() => (online ? void goOffline() : void goOnline())}
          disabled={!podeFicarOnline || togglingOnline}
          style={({ pressed }) => [
            styles.hero,
            online ? styles.heroOn : styles.heroOff,
            (!podeFicarOnline || togglingOnline) && styles.heroDisabled,
            pressed && styles.heroPressed,
          ]}
        >
          <View style={[styles.heroRing, online && styles.heroRingOn]}>
            {togglingOnline ? (
              <ActivityIndicator color={online ? theme.colors.primary : theme.colors.textSecondary} />
            ) : (
              <ScooterGlyph color={online ? theme.colors.primary : theme.colors.textSecondary} />
            )}
          </View>
          <Text style={[styles.heroState, online ? styles.heroStateOn : styles.heroStateOff]}>
            {online ? 'Disponível' : 'Indisponível'}
          </Text>
          <Text style={styles.heroHint}>
            {togglingOnline
              ? 'Um instante…'
              : online
                ? 'Você está recebendo ofertas. Toque para parar.'
                : 'Toque para começar a receber ofertas.'}
          </Text>
        </Pressable>

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

function ScooterGlyph({ color }: { color: string }): React.JSX.Element {
  return <Text style={{ fontSize: 42, color }}>🛵</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg },
  greeting: { fontFamily: theme.fonts.heading, fontSize: 26, color: theme.colors.text, marginBottom: theme.spacing.lg },
  warnCard: { borderColor: theme.colors.accent, marginBottom: theme.spacing.md },
  warnTitle: { fontFamily: theme.fonts.bodySemiBold, color: theme.colors.accent, fontSize: 15, marginBottom: 4 },
  warnText: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },

  hero: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  heroOn: { backgroundColor: theme.colors.primaryWeak, borderColor: theme.colors.primary },
  heroOff: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  heroDisabled: { opacity: 0.55 },
  heroPressed: { opacity: 0.85 },
  heroRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface },
  heroState: { fontFamily: theme.fonts.heading, fontSize: 24 },
  heroStateOn: { color: theme.colors.primary },
  heroStateOff: { color: theme.colors.textSecondary },
  heroHint: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 240 },

  statsRow: { flexDirection: 'row', gap: theme.spacing.md },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: theme.fonts.heading, fontSize: 28, color: theme.colors.primary },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
});
