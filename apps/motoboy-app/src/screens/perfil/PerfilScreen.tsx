import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { acceptTerms } from '../../api/motoboy';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme/theme';

const APROVACAO: Record<string, string> = {
  pending_approval: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Não aprovado',
};

function Row({ label, value, last }: { label: string; value: string; last?: boolean }): React.JSX.Element {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

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

        <View style={styles.idBlock}>
          <Avatar name={me?.fullName ?? '?'} src={me?.avatarUrl} size={60} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.nome}>{me?.fullName ?? '—'}</Text>
            {me?.phone ? <Text style={styles.sub}>{me.phone}</Text> : null}
            {me?.city ? <Text style={styles.sub}>{me.city}</Text> : null}
          </View>
        </View>

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

        <View style={styles.list}>
          <Row label="Nome" value={me?.fullName ?? '—'} />
          <Row label="Telefone" value={me?.phone ?? 'Não informado'} />
          <Row label="Cidade" value={me?.city ?? 'Não informada'} />
          <Row label="Cadastro" value={APROVACAO[me?.approvalStatus ?? ''] ?? '—'} />
          <Row label="Chave Pix (repasse)" value={me?.pixKey ?? 'Não cadastrada'} last />
        </View>
        <Text style={styles.hint}>Para cadastrar ou alterar a chave Pix, use o painel web por enquanto.</Text>

        {me?.terms && (
          <Card style={[styles.termsCard, { borderColor: theme.colors.accent }]}>
            <Text style={styles.rowLabel}>Termos de uso (versão {me.terms.version})</Text>
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
  idBlock: { marginBottom: theme.spacing.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  nome: { fontFamily: theme.fonts.headingSemiBold, fontSize: 20, color: theme.colors.text },
  sub: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: theme.fonts.heading, fontSize: 26, color: theme.colors.primary },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },

  list: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary },
  rowValue: { fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.text, flexShrink: 1, textAlign: 'right' },
  hint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },

  termsCard: { marginTop: theme.spacing.md },
  termsBox: { maxHeight: 220, marginTop: theme.spacing.sm, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: theme.spacing.sm },
  termsText: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
});
