import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BadgeCheck, ChevronRight, FileText, MapPin, Moon, Phone, Star, TrendingUp, User, Wallet } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { acceptTerms, setPixKey } from '../../api/motoboy';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import type { AppStackParamList } from '../../navigation/types';
import { useTheme, useThemeMode } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/theme';

const PIX_TYPES: { v: string; label: string }[] = [
  { v: 'cpf', label: 'CPF' },
  { v: 'phone', label: 'Celular' },
  { v: 'email', label: 'E-mail' },
  { v: 'random', label: 'Aleatória' },
  { v: 'cnpj', label: 'CNPJ' },
];

const APPEARANCE_OPTIONS: { v: 'system' | 'light' | 'dark'; label: string }[] = [
  { v: 'system', label: 'Automático' },
  { v: 'light', label: 'Claro' },
  { v: 'dark', label: 'Escuro' },
];

const APROVACAO: Record<string, string> = {
  pending_approval: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Não aprovado',
};

function SectionTitle({ children }: { children: string }): React.JSX.Element {
  const styles = makeStyles(useTheme());
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): React.JSX.Element {
  const styles = makeStyles(useTheme());
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
  const styles = makeStyles(useTheme());
  return (
    <View style={styles.segmented}>
      {PIX_TYPES.map((opt) => {
        const active = value === opt.v;
        return (
          <Pressable key={opt.v} onPress={() => onChange(opt.v)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AppearanceSegmented(): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const { mode, setMode } = useThemeMode();
  return (
    <View style={styles.segmented}>
      {APPEARANCE_OPTIONS.map((opt) => {
        const active = mode === opt.v;
        return (
          <Pressable key={opt.v} onPress={() => setMode(opt.v)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
              {opt.label}
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
  const t = useTheme();
  const styles = makeStyles(t);
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
            <Wallet size={16} color={t.colors.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Chave Pix (repasse)</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {pixKey}
            </Text>
          </View>
        </View>
        <Button label="Trocar chave" variant="outline" onPress={() => setEditing(true)} style={{ marginTop: t.spacing.md }} />
      </Card>
    );
  }

  return (
    <Card style={styles.pixCard}>
      <Text style={styles.fieldLabel}>Tipo da chave</Text>
      <PixSegmented value={type} onChange={setType} />
      <View style={{ marginTop: t.spacing.sm }}>
        <TextField label="Sua chave Pix" value={key} onChangeText={setKey} autoCapitalize="none" placeholder="Cole ou digite aqui" />
      </View>
      <Button label="Salvar chave Pix" onPress={() => void save()} loading={saving} disabled={key.trim().length < 5} />
    </Card>
  );
}

export function PerfilScreen(): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const { me, logout, refreshMe } = useAuth();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
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
            <Star size={15} color={t.colors.textSecondary} strokeWidth={2} />
            <Text style={styles.statValue}>{me?.rating != null ? me.rating.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Nota média</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={15} color={t.colors.textSecondary} strokeWidth={2} />
            <Text style={styles.statValue}>{me?.deliveriesCompleted ?? 0}</Text>
            <Text style={styles.statLabel}>Entregas</Text>
          </View>
        </View>

        <SectionTitle>DADOS PESSOAIS</SectionTitle>
        <Card style={styles.fieldsCard}>
          <Field icon={<User size={16} color={t.colors.textSecondary} strokeWidth={2} />} label="Nome" value={me?.fullName ?? '—'} />
          <View style={styles.fieldDivider} />
          <Field icon={<Phone size={16} color={t.colors.textSecondary} strokeWidth={2} />} label="Telefone" value={me?.phone ?? 'Não informado'} />
          <View style={styles.fieldDivider} />
          <Field icon={<MapPin size={16} color={t.colors.textSecondary} strokeWidth={2} />} label="Cidade" value={me?.city ?? 'Não informada'} />
          <View style={styles.fieldDivider} />
          <Field
            icon={<BadgeCheck size={16} color={t.colors.textSecondary} strokeWidth={2} />}
            label="Cadastro"
            value={APROVACAO[me?.approvalStatus ?? ''] ?? '—'}
          />
        </Card>

        <SectionTitle>DOCUMENTOS</SectionTitle>
        <Card style={styles.fieldsCard}>
          <Pressable style={styles.field} onPress={() => nav.navigate('Documentos')}>
            <View style={styles.fieldIcon}>
              <FileText size={16} color={t.colors.textSecondary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>CRLV e foto do rosto</Text>
              <Text style={styles.fieldValue}>Enviar ou atualizar</Text>
            </View>
            <ChevronRight size={16} color={t.colors.textSecondary} />
          </Pressable>
        </Card>

        <SectionTitle>RECEBIMENTO</SectionTitle>
        <PixEditor pixKey={me?.pixKey ?? null} pixKeyType={me?.pixKeyType ?? null} onSaved={refreshMe} />

        <SectionTitle>APARÊNCIA</SectionTitle>
        <Card style={styles.fieldsCard}>
          <View style={styles.field}>
            <View style={styles.fieldIcon}>
              <Moon size={16} color={t.colors.textSecondary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Tema do app</Text>
              <View style={{ marginTop: 6 }}>
                <AppearanceSegmented />
              </View>
            </View>
          </View>
        </Card>

        {me?.terms && (
          <Card style={[styles.termsCard, { borderColor: t.colors.accent }]}>
            <Text style={styles.fieldLabel}>Termos de uso (versão {me.terms.version})</Text>
            {showTerms ? (
              <>
                <ScrollView style={styles.termsBox}>
                  <Text style={styles.termsText}>{me.terms.content}</Text>
                </ScrollView>
                <Button label="Li e aceito os termos" onPress={() => void handleAccept()} loading={accepting} style={{ marginTop: t.spacing.sm }} />
              </>
            ) : (
              <Button label="Ver e aceitar os termos" variant="outline" onPress={() => setShowTerms(true)} style={{ marginTop: t.spacing.sm }} />
            )}
          </Card>
        )}

        <Button label="Sair" variant="danger" onPress={() => void logout()} style={{ marginTop: t.spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    content: { padding: t.spacing.lg },
    title: { fontFamily: t.fonts.heading, fontSize: 26, color: t.colors.text, marginBottom: t.spacing.lg },
    idBlock: { marginBottom: t.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    nome: { fontFamily: t.fonts.headingSemiBold, fontSize: 19, color: t.colors.text },
    sub: { fontFamily: t.fonts.body, fontSize: 13, color: t.colors.textSecondary, marginTop: 2 },

    sectionTitle: {
      fontFamily: t.fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1.1,
      color: t.colors.textSecondary,
      marginBottom: t.spacing.sm,
      marginTop: t.spacing.xs,
    },

    statsRow: { flexDirection: 'row', gap: t.spacing.sm, marginBottom: t.spacing.lg },
    statCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.md,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    statValue: { fontFamily: t.fonts.bodySemiBold, fontSize: 15, color: t.colors.text },
    statLabel: { fontFamily: t.fonts.body, fontSize: 11, color: t.colors.textSecondary, flexShrink: 1 },

    fieldsCard: { padding: 0, marginBottom: t.spacing.lg, overflow: 'hidden' },
    field: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.md },
    fieldDivider: { height: 1, backgroundColor: t.colors.border, marginLeft: t.spacing.md + 32 + t.spacing.sm },
    fieldIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldLabel: { fontFamily: t.fonts.body, fontSize: 12, color: t.colors.textSecondary },
    fieldValue: { fontFamily: t.fonts.bodySemiBold, fontSize: 14, color: t.colors.text, marginTop: 1 },

    pixCard: { marginBottom: t.spacing.lg },
    pixCurrentRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },

    segmented: {
      flexDirection: 'row',
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.sm,
      padding: 3,
      marginTop: 6,
      marginBottom: t.spacing.sm,
    },
    segment: { flex: 1, paddingVertical: 8, borderRadius: t.radius.sm - 2, alignItems: 'center' },
    segmentActive: { backgroundColor: t.colors.primary },
    segmentLabel: { fontFamily: t.fonts.bodyMedium, fontSize: 11, color: t.colors.textSecondary },
    segmentLabelActive: { color: t.colors.onPrimary, fontFamily: t.fonts.bodySemiBold },

    termsCard: { marginBottom: t.spacing.md },
    termsBox: { maxHeight: 220, marginTop: t.spacing.sm, backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.sm, padding: t.spacing.sm },
    termsText: { fontFamily: t.fonts.body, fontSize: 13, color: t.colors.text, lineHeight: 19 },
  });
}
