import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { CheckCircle2, Circle, FileText, UserRound } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDriverDocs, uploadDriverDocument, type DriverDocsStatus } from '../../api/motoboy';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/theme';

type DocType = 'personal' | 'personal_back' | 'vehicle' | 'avatar';

const DOC_META: Record<DocType, { title: string; hint: string; camera: ImagePicker.CameraType; allowPdf: boolean }> = {
  personal: {
    title: 'CNH ou RG — frente',
    hint: 'Tire uma foto legível da frente do seu documento com CPF (CNH ou RG).',
    camera: ImagePicker.CameraType.back,
    allowPdf: false,
  },
  personal_back: {
    title: 'CNH ou RG — verso',
    hint: 'Tire uma foto legível do verso do documento.',
    camera: ImagePicker.CameraType.back,
    allowPdf: false,
  },
  vehicle: {
    title: 'CRLV do veículo',
    hint: 'Tire uma foto ou envie o PDF do CRLV.',
    camera: ImagePicker.CameraType.back,
    allowPdf: true,
  },
  avatar: {
    title: 'Foto do rosto',
    hint: 'Uma foto sua, de rosto, bem iluminada — aparece no seu perfil.',
    camera: ImagePicker.CameraType.front,
    allowPdf: false,
  },
};

async function takePhoto(camera: ImagePicker.CameraType): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Precisamos da câmera', 'Permita o uso da câmera pra enviar o documento.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true, cameraType: camera });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType ?? 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
}

async function pickPdf(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', base64: true });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  if (asset.size != null && asset.size > 3.5 * 1024 * 1024) {
    Alert.alert('Arquivo muito grande', 'Envie um PDF de até 3,5 MB.');
    return null;
  }
  return `data:application/pdf;base64,${asset.base64}`;
}

function DocCard({
  type,
  url,
  busy,
  onUploaded,
}: {
  type: DocType;
  url: string | null;
  busy: boolean;
  onUploaded: (type: DocType, base64: string) => void;
}): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const meta = DOC_META[type];
  const sent = !!url;
  const isPdf = !!url && /\.pdf(\?|$)/i.test(url);

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{meta.title}</Text>
        <View style={[styles.statusPill, sent ? styles.statusPillOk : styles.statusPillPending]}>
          {sent ? (
            <CheckCircle2 size={13} color={t.colors.success} strokeWidth={2} />
          ) : (
            <Circle size={13} color={t.colors.textSecondary} strokeWidth={2} />
          )}
          <Text style={[styles.statusLabel, sent ? styles.statusLabelOk : styles.statusLabelPending]}>
            {sent ? 'Enviado' : 'Pendente'}
          </Text>
        </View>
      </View>
      <Text style={styles.cardHint}>{meta.hint}</Text>

      {sent && (
        <View style={styles.preview}>
          {isPdf ? (
            <View style={styles.previewPdf}>
              <FileText size={22} color={t.colors.textSecondary} strokeWidth={2} />
              <Text style={styles.previewPdfText}>PDF enviado</Text>
            </View>
          ) : type === 'avatar' ? (
            <Image source={{ uri: url }} style={styles.previewAvatar} />
          ) : (
            <Image source={{ uri: url }} style={styles.previewDoc} resizeMode="cover" />
          )}
        </View>
      )}

      <Button
        label={sent ? 'Enviar outra foto' : 'Tirar foto'}
        variant={sent ? 'outline' : 'primary'}
        loading={busy}
        onPress={async () => {
          const b64 = await takePhoto(meta.camera);
          if (b64) onUploaded(type, b64);
        }}
      />
      {meta.allowPdf && (
        <Pressable disabled={busy} onPress={async () => {
          const b64 = await pickPdf();
          if (b64) onUploaded(type, b64);
        }}>
          <Text style={styles.pdfLink}>ou enviar como PDF</Text>
        </Pressable>
      )}
    </Card>
  );
}

export function DocumentosScreen(): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const [status, setStatus] = useState<DriverDocsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<DocType | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await getDriverDocs());
    } catch {
      /* ignora — tela mostra pendente até conseguir de novo */
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function handleUpload(type: DocType, base64: string): Promise<void> {
    setBusyType(type);
    try {
      const r = await uploadDriverDocument(type, base64);
      setStatus(r);
      if (r.requiresReview) {
        Alert.alert(
          'Documento enviado',
          'Como você já estava aprovado, esse documento precisa passar por uma nova revisão antes de você voltar a receber ofertas.',
        );
      } else {
        Alert.alert('Pronto', 'Documento enviado.');
      }
    } catch (e) {
      Alert.alert('Não deu certo', (e as Error).message || 'Tente de novo.');
    } finally {
      setBusyType(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={t.colors.primary} style={{ marginTop: t.spacing.xl }} />
        ) : (
          <>
            <View style={styles.intro}>
              <View style={styles.introIcon}>
                <UserRound size={22} color={t.colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.introText}>
                Mantenha seus documentos em dia. O time do Leeva confere manualmente — pode levar até um dia útil.
              </Text>
            </View>

            <DocCard type="personal" url={status?.personalDocUrl ?? null} busy={busyType === 'personal'} onUploaded={handleUpload} />
            <DocCard type="personal_back" url={status?.personalDocBackUrl ?? null} busy={busyType === 'personal_back'} onUploaded={handleUpload} />
            <DocCard type="vehicle" url={status?.vehicleDocUrl ?? null} busy={busyType === 'vehicle'} onUploaded={handleUpload} />
            <DocCard type="avatar" url={status?.avatarUrl ?? null} busy={busyType === 'avatar'} onUploaded={handleUpload} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    content: { padding: t.spacing.lg, gap: t.spacing.md },

    intro: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
      backgroundColor: t.colors.surfaceAlt,
      borderRadius: t.radius.md,
      padding: t.spacing.md,
      marginBottom: t.spacing.xs,
    },
    introIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.primaryWeak,
      alignItems: 'center',
      justifyContent: 'center',
    },
    introText: { flex: 1, fontFamily: t.fonts.body, fontSize: 13, color: t.colors.textSecondary, lineHeight: 18 },

    card: { gap: t.spacing.sm },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontFamily: t.fonts.bodySemiBold, fontSize: 15, color: t.colors.text },
    cardHint: { fontFamily: t.fonts.body, fontSize: 12, color: t.colors.textSecondary, marginTop: -4 },

    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: t.radius.pill },
    statusPillOk: { backgroundColor: 'rgba(85,196,127,0.12)' },
    statusPillPending: { backgroundColor: t.colors.surfaceAlt },
    statusLabel: { fontFamily: t.fonts.bodySemiBold, fontSize: 11 },
    statusLabelOk: { color: t.colors.success },
    statusLabelPending: { color: t.colors.textSecondary },

    preview: { alignItems: 'center' },
    previewAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: t.colors.surfaceAlt },
    previewDoc: { width: '100%', height: 140, borderRadius: t.radius.sm, backgroundColor: t.colors.surfaceAlt },
    previewPdf: {
      width: '100%',
      height: 80,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    previewPdfText: { fontFamily: t.fonts.bodyMedium, fontSize: 12, color: t.colors.textSecondary },
    pdfLink: {
      fontFamily: t.fonts.bodyMedium,
      fontSize: 13,
      color: t.colors.primary,
      textAlign: 'center',
      marginTop: -4,
    },
  });
}
