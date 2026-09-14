import { BadgeCheck, MapPin, Phone, Star, TrendingUp, User, Wallet } from 'lucide-react-native';
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

function SectionTitle({ children }: { children: string }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.field}>
      <View style={styles.fieldIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function PixSegmented({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  return (
    <View style={styles.segmented}>
      {PIX_TYPES.map((t) => {
        const active = value === t.v;
        return (
          <Pressable key={t.v} onPress={() => onChange(t.v)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PixEditor({
  pixKey,
  pixKeyType,
  onSaved,
}: {
  pixKey: string | null;
  pixKeyType: string | null;
  onSaved: () => Promise<void>;
}): React.JSX.Element {
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
        <View style={styles.pixCurrentRow}>
          <View style={styles.fieldIcon}>
            <Wallet size={16} color={theme.colors.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Chave Pix (repasse)</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {pixKey}
            </Text>
          </View>
        </View>
        <Button label="Trocar chave" variant="outline" onPress={() => setEditing(true)} style={{ marginTop: theme.spacing.md }} />
      </Card>
    );
  }

  return (
    <Card style={styles.pixCard}>
      <Text style={styles.fieldLabel}>Tipo da chave</Text>
      <PixSegmented value={type} onChange={setType} />
      <View style={{ marginTop: theme.spacing.sm }}>
        <TextField label="Sua chave Pix" value={key} onChangeText={setKey} autoCapitalize="none" placeholder="Cole ou digite aqui" />
      </View>
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
          <Avatar name={me?.fullName ?? '?'} src={me?.avatarUrl} size={56} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.nome}>{me?.fullName ?? '—'}</Text>
            {me?.city ? <Text style={styles.sub}>{me.city}</Text> : null}
          </View>
        </View>

        <SectionTitle>DESEMPENHO</SectionTitle>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Star size={15} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text style={styles.statValue}>{me?.rating != null ? me.rating.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Nota média</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={15} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text style={styles.statValue}>{me?.deliveriesCompleted ?? 0}</Text>
            <Text style={styles.statLabel}>Entregas</Text>
          </View>
        </View>

        <SectionTitle>DADOS PESSOAIS</SectionTitle>
        <Card style={styles.fieldsCard}>
          <Field icon={<User size={16} color={theme.colors.textSecondary} strokeWidth={2} />} label="Nome" value={me?.fullName ?? '—'} />
          <View style={styles.fieldDivider} />
          <Field icon={<Phone size={16} color={theme.colors.textSecondary} strokeWidth={2} />} label="Telefone" value={me?.phone ?? 'Não informado'} />
          <View style={styles.fieldDivider} />
          <Field icon={<MapPin size={16} color={theme.colors.textSecondary} strokeWidth={2} />} label="Cidade" value={me?.city ?? 'Não informada'} />
          <View style={styles.fieldDivider} />
          <Field
            icon={<BadgeCheck size={16} color={theme.colors.textSecondary} strokeWidth={2} />}
            label="Cadastro"
            value={APROVACAO[me?.approvalStatus ?? ''] ?? '—'}
          />
        </Card>

        <SectionTitle>RECEBIMENTO</SectionTitle>
        <PixEditor pixKey={me?.pixKey ?? null} pixKeyType={me?.pixKeyType ?? null} onSaved={refreshMe} />

        {me?.terms && (
          <Card style={[styles.termsCard, { borderColor: theme.colors.accent }]}>
            <Text style={styles.fieldLabel}>Termos de uso (versão {me.terms.version})</Text>
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
  idBlock: { marginBottom: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  nome: { fontFamily: theme.fonts.headingSemiBold, fontSize: 19, color: theme.colors.text },
  sub: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },

  sectionTitle: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },

  statsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statValue: { fontFamily: theme.fonts.bodySemiBold, fontSize: 15, color: theme.colors.text },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textSecondary, flexShrink: 1 },

  fieldsCard: { padding: 0, marginBottom: theme.spacing.lg, overflow: 'hidden' },
  field: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.md },
  fieldDivider: { height: 1, backgroundColor: theme.colors.border, marginLeft: theme.spacing.md + 32 + theme.spacing.sm },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  fieldValue: { fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.text, marginTop: 1 },

  pixCard: { marginBottom: theme.spacing.lg },
  pixCurrentRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },

  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: 3,
    marginTop: 6,
    marginBottom: theme.spacing.sm,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.sm - 2, alignItems: 'center' },
  segmentActive: { backgroundColor: theme.colors.primary },
  segmentLabel: { fontFamily: theme.fonts.bodyMedium, fontSize: 11, color: theme.colors.textSecondary },
  segmentLabelActive: { color: theme.colors.onPrimary, fontFamily: theme.fonts.bodySemiBold },

  termsCard: { marginBottom: theme.spacing.md },
  termsBox: { maxHeight: 220, marginTop: theme.spacing.sm, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: theme.spacing.sm },
  termsText: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
});
