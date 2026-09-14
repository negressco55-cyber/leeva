import * as ImagePicker from 'expo-image-picker';
import { CheckCircle2, Circle, UserRound } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getDriverDocs, uploadDriverDocument, type DriverDocsStatus } from '../../api/motoboy';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { theme } from '../../theme/theme';

type DocType = 'vehicle' | 'avatar';

const DOC_META: Record<DocType, { title: string; hint: string; camera: ImagePicker.CameraType }> = {
  vehicle: {
    title: 'CRLV do veículo',
    hint: 'Tire uma foto legível do documento do veículo (CRLV).',
    camera: ImagePicker.CameraType.back,
  },
  avatar: {
    title: 'Foto do rosto',
    hint: 'Uma foto sua, de rosto, bem iluminada — aparece no seu perfil.',
    camera: ImagePicker.CameraType.front,
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
  const meta = DOC_META[type];
  const sent = !!url;

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{meta.title}</Text>
        <View style={[styles.statusPill, sent ? styles.statusPillOk : styles.statusPillPending]}>
          {sent ? (
            <CheckCircle2 size={13} color={theme.colors.success} strokeWidth={2} />
          ) : (
            <Circle size={13} color={theme.colors.textSecondary} strokeWidth={2} />
          )}
          <Text style={[styles.statusLabel, sent ? styles.statusLabelOk : styles.statusLabelPending]}>
            {sent ? 'Enviado' : 'Pendente'}
          </Text>
        </View>
      </View>
      <Text style={styles.cardHint}>{meta.hint}</Text>

      {sent && (
        <View style={styles.preview}>
          {type === 'avatar' ? (
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
    </Card>
  );
}

export function DocumentosScreen(): React.JSX.Element {
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
      Alert.alert('Pronto', 'Documento enviado.');
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
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
        ) : (
          <>
            <View style={styles.intro}>
              <View style={styles.introIcon}>
                <UserRound size={22} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.introText}>
                Mantenha seus documentos em dia. O time do Leeva confere manualmente — pode levar até um dia útil.
              </Text>
            </View>

            <DocCard type="vehicle" url={status?.vehicleDocUrl ?? null} busy={busyType === 'vehicle'} onUploaded={handleUpload} />
            <DocCard type="avatar" url={status?.avatarUrl ?? null} busy={busyType === 'avatar'} onUploaded={handleUpload} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },

  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  introIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: { flex: 1, fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },

  card: { gap: theme.spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: theme.fonts.bodySemiBold, fontSize: 15, color: theme.colors.text },
  cardHint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: -4 },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  statusPillOk: { backgroundColor: 'rgba(85,196,127,0.12)' },
  statusPillPending: { backgroundColor: theme.colors.surfaceAlt },
  statusLabel: { fontFamily: theme.fonts.bodySemiBold, fontSize: 11 },
  statusLabelOk: { color: theme.colors.success },
  statusLabelPending: { color: theme.colors.textSecondary },

  preview: { alignItems: 'center' },
  previewAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: theme.colors.surfaceAlt },
  previewDoc: { width: '100%', height: 140, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceAlt },
});
