import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { acceptTerms } from '../../api/motoboy';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme/theme';

const APROVACAO: Record<string, string> = {
  pending_approval: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Não aprovado',
};

export function PerfilScreen(): React.JSX.Element {
  const { me, logout, refreshMe } = useAuth();
  const [showTerms, setShowTerms] = useState(false);
  const [accepting, setAccepting] = useState(false);

  async function handleAccept(): Promise<void> {
    if (!me?.terms) return;
    setAccepting(true);
    try {
      await acceptTerms(me.terms.version);
      await refreshMe();
      setShowTerms(false);
      Alert.alert('Pronto', 'Termos aceitos. Você já pode ficar disponível.');
    } catch (e) {
      Alert.alert('Erro', (e as Error).message || 'Tente de novo.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Perfil</Text>

        <Card style={styles.card}>
          <Text style={styles.nome}>{me?.fullName ?? '—'}</Text>
          {me?.phone ? <Text style={styles.sub}>{me.phone}</Text> : null}
          {me?.city ? <Text style={styles.sub}>{me.city}</Text> : null}
        </Card>

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{me?.rating != null ? me.rating.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Nota média</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{me?.deliveriesCompleted ?? 0}</Text>
            <Text style={styles.statLabel}>Entregas</Text>
          </Card>
        </View>

        <Card style={styles.card}>
          <Text style={styles.infoLabel}>Status do cadastro</Text>
          <Text style={styles.infoValor}>{APROVACAO[me?.approvalStatus ?? ''] ?? '—'}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.infoLabel}>Chave Pix (repasse)</Text>
          <Text style={styles.infoValor}>{me?.pixKey ?? 'Não cadastrada'}</Text>
          <Text style={styles.sub}>Para cadastrar/alterar a chave Pix, use o painel web por enquanto.</Text>
        </Card>

        {me?.terms && (
          <Card style={[styles.card, { borderColor: theme.colors.accent }]}>
            <Text style={styles.infoLabel}>Termos de uso (versão {me.terms.version})</Text>
            {showTerms ? (
              <>
                <ScrollView style={styles.termsBox}>
                  <Text style={styles.termsText}>{me.terms.content}</Text>
                </ScrollView>
                <Button label="Li e aceito os termos" onPress={() => void handleAccept()} loading={accepting} style={{ marginTop: theme.spacing.sm }} />
              </>
            ) : (
              <Button label="Ver e aceitar os termos" variant="outline" onPress={() => setShowTerms(true)} style={{ marginTop: theme.spacing.sm }} />
            )}
          </Card>
        )}

        <Button label="Sair" variant="danger" onPress={() => void logout()} style={{ marginTop: theme.spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg },
  title: { fontFamily: theme.fonts.heading, fontSize: 26, color: theme.colors.text, marginBottom: theme.spacing.lg },
  card: { marginBottom: theme.spacing.md },
  nome: { fontFamily: theme.fonts.headingSemiBold, fontSize: 20, color: theme.colors.text },
  sub: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: theme.fonts.heading, fontSize: 26, color: theme.colors.primary },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  infoLabel: { fontFamily: theme.fonts.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  infoValor: { fontFamily: theme.fonts.bodySemiBold, fontSize: 16, color: theme.colors.text, marginTop: 4 },
  termsBox: { maxHeight: 220, marginTop: theme.spacing.sm, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: theme.spacing.sm },
  termsText: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
});
