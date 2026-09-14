import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { acceptTerms, setPixKey } from '../../api/motoboy';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme/theme';

const PIX_TYPES: { v: string; label: string }[] = [
  { v: 'cpf', label: 'CPF' },
  { v: 'phone', label: 'Celular' },
  { v: 'email', label: 'E-mail' },
  { v: 'random', label: 'Aleatória' },
  { v: 'cnpj', label: 'CNPJ' },
];

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

function PixEditor({ pixKey, pixKeyType, onSaved }: { pixKey: string | null; pixKeyType: string | null; onSaved: () => Promise<void> }): React.JSX.Element {
  const [editing, setEditing] = useState(!pixKey);
  const [type, setType] = useState(pixKeyType ?? 'cpf');
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    if (key.trim().length < 5) {
      Alert.alert('Chave inválida', 'Digite uma chave Pix válida.');
      return;
    }
    setSaving(true);
    try {
      await setPixKey(key.trim(), type);
      await onSaved();
      setEditing(false);
      setKey('');
      Alert.alert('Pronto', 'Chave Pix salva. Seus repasses vão para essa chave.');
    } catch (e) {
      Alert.alert('Erro', (e as Error).message || 'Não foi possível salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  if (!editing && pixKey) {
    return (
      <Card style={styles.pixCard}>
        <Text style={styles.rowLabel}>Chave Pix (repasse)</Text>
        <Text style={styles.pixValue}>{pixKey}</Text>
        <Button label="Trocar chave" variant="outline" onPress={() => setEditing(true)} style={{ marginTop: theme.spacing.sm }} />
      </Card>
    );
  }

  return (
    <Card style={styles.pixCard}>
      <Text style={styles.rowLabel}>Cadastrar chave Pix (repasse)</Text>
      <View style={styles.pixTypes}>
        {PIX_TYPES.map((t) => (
          <Pressable key={t.v} onPress={() => setType(t.v)} style={[styles.pixTypeChip, type === t.v && styles.pixTypeChipActive]}>
            <Text style={[styles.pixTypeLabel, type === t.v && styles.pixTypeLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextField label="Sua chave Pix" value={key} onChangeText={setKey} autoCapitalize="none" placeholder="Cole ou digite aqui" />
      <Button label="Salvar chave Pix" onPress={() => void save()} loading={saving} disabled={key.trim().length < 5} />
    </Card>
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
          <Row label="Cadastro" value={APROVACAO[me?.approvalStatus ?? ''] ?? '—'} last />
        </View>

        <PixEditor pixKey={me?.pixKey ?? null} pixKeyType={me?.pixKeyType ?? null} onSaved={refreshMe} />

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

  pixCard: { marginTop: theme.spacing.md },
  pixValue: { fontFamily: theme.fonts.bodySemiBold, fontSize: 16, color: theme.colors.text, marginTop: 4 },
  pixTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm },
  pixTypeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  pixTypeChipActive: { backgroundColor: theme.colors.primaryWeak, borderColor: theme.colors.primary },
  pixTypeLabel: { fontFamily: theme.fonts.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  pixTypeLabelActive: { color: theme.colors.primary },

  termsCard: { marginTop: theme.spacing.md },
  termsBox: { maxHeight: 220, marginTop: theme.spacing.sm, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: theme.spacing.sm },
  termsText: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
});
