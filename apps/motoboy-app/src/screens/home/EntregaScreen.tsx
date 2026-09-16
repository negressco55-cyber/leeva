import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, Linking, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { MapaEntrega } from '../../components/MapaEntrega';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatusBadge } from '../../components/StatusBadge';
import { usePosition } from '../../context/PositionContext';
import { useRide } from '../../context/RideContext';
import type { AppStackParamList } from '../../navigation/types';
import { theme } from '../../theme/theme';
import type { Delivery, OrderStatus } from '../../types';

type Props = NativeStackScreenProps<AppStackParamList, 'Entrega'>;

const ACAO: Partial<Record<OrderStatus, string>> = {
  assigned: 'Cheguei — coletar o pedido',
  picked_up: 'Sair para a entrega',
};

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

function prepBadge(d: Delivery): { text: string; color: string } | null {
  if (d.readyAt) return { text: '🔔 Pronto pra retirada', color: theme.colors.success };
  if (!d.preparingAt) return null;
  if (!d.prepEstimateMinutes) return { text: 'Em preparo', color: theme.colors.accent };
  const leftMin = Math.round((new Date(d.preparingAt).getTime() + d.prepEstimateMinutes * 60_000 - Date.now()) / 60_000);
  return {
    text: leftMin > 0 ? `Em preparo · pronto em ~${leftMin} min` : 'Em preparo · deveria estar pronto',
    color: theme.colors.accent,
  };
}

async function takeDeliveryPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Precisamos da câmera', 'Permita o uso da câmera para tirar a foto da entrega.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.5,
    base64: true,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType ?? 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
}

export function EntregaScreen({ navigation }: Props): React.JSX.Element {
  const { activeDelivery, advancing, advanceActive, confirmDelivery } = useRide();
  const { position } = usePosition();
  const [photo, setPhoto] = useState<string | null>(null);
  const [code, setCode] = useState('');

  if (!activeDelivery) {
    return (
      <ScreenContainer>
        <Text style={styles.empty}>Nenhuma entrega em andamento.</Text>
        <Button label="Voltar" onPress={() => navigation.goBack()} style={{ marginTop: theme.spacing.lg }} />
      </ScreenContainer>
    );
  }

  const d = activeDelivery;
  const naColeta = d.status === 'assigned';
  const alvo = naColeta
    ? { lat: d.pickupLat, lng: d.pickupLng, endereco: d.pickupAddress ?? d.pickupName }
    : { lat: d.dropoffLat, lng: d.dropoffLng, endereco: d.dropoffAddress };
  const acaoLabel = ACAO[d.status];
  const entregue = d.status === 'delivered';
  const collectFromCustomer = d.paymentStatus !== 'paid' && d.paymentMethod !== 'online';

  function abrirMapa(): void {
    if (alvo.lat == null || alvo.lng == null) return;
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${alvo.lat},${alvo.lng}`);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>{entregue ? 'Entrega concluída' : 'Entrega em andamento'}</Text>
      <StatusBadge status={d.status} />
      {naColeta &&
        (() => {
          const pb = prepBadge(d);
          if (!pb) return null;
          return (
            <View style={[styles.prepBadge, { backgroundColor: pb.color + '22', borderColor: pb.color }]}>
              <Text style={[styles.prepBadgeText, { color: pb.color }]}>{pb.text}</Text>
            </View>
          );
        })()}

      <Card style={styles.valorCard}>
        <Text style={styles.valorLabel}>Você recebe por esta entrega</Text>
        <Text style={styles.valor}>{d.payout != null ? brl(d.payout) : '—'}</Text>
      </Card>

      {collectFromCustomer && (
        <Card style={[styles.card, { borderColor: theme.colors.accent }]}>
          <Text style={styles.label}>Receber do cliente na entrega</Text>
          <Text style={styles.endereco}>{brl(d.orderAmount)}</Text>
        </Card>
      )}

      <View style={styles.actions}>
        {!entregue && alvo.lat != null && (
          <Button label={`Abrir no mapa (${naColeta ? 'coleta' : 'entrega'})`} variant="outline" onPress={abrirMapa} />
        )}
        {!entregue && acaoLabel && (
          <Button label={acaoLabel} onPress={() => void advanceActive()} loading={advancing} />
        )}

        {d.status === 'in_route' && (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={styles.dest}>
              Para concluir, tire uma foto da entrega e peça pro cliente o código de confirmação dele. Você
              precisa estar no endereço.
            </Text>
            {!photo ? (
              <Button
                label="Tirar foto da entrega"
                variant="outline"
                onPress={async () => setPhoto(await takeDeliveryPhoto())}
              />
            ) : (
              <>
                <Image source={{ uri: photo }} style={styles.fotoPreview} />
                <Button label="Tirar outra" variant="outline" onPress={() => setPhoto(null)} />
                <TextInput
                  style={styles.codeInput}
                  placeholder="Código de confirmação do cliente"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))}
                />
                <Button
                  label="Confirmar entrega"
                  disabled={code.trim().length < 4}
                  loading={advancing}
                  onPress={async () => {
                    if (!photo) return;
                    const ok = await confirmDelivery(photo, code.trim());
                    if (ok) {
                      setPhoto(null);
                      setCode('');
                    }
                  }}
                />
              </>
            )}
          </View>
        )}

        {entregue && <Button label="Concluir" onPress={() => navigation.goBack()} />}
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>Coleta</Text>
        <Text style={styles.endereco}>{d.pickupName}</Text>
        {d.pickupAddress ? <Text style={styles.dest}>{d.pickupAddress}</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>Entrega</Text>
        <Text style={styles.endereco}>{d.dropoffAddress}</Text>
        <Text style={styles.dest}>
          {d.customerName}
          {d.customerPhone ? ` · ${d.customerPhone}` : ''}
        </Text>
      </Card>

      {d.notes ? (
        <Card style={styles.card}>
          <Text style={styles.label}>Observações</Text>
          <Text style={styles.endereco}>{d.notes}</Text>
        </Card>
      ) : null}

      {d.pickupLat != null && d.dropoffLat != null && (
        <MapaEntrega
          pickupLat={d.pickupLat}
          pickupLng={d.pickupLng as number}
          dropoffLat={d.dropoffLat}
          dropoffLng={d.dropoffLng as number}
          motoboyLat={position?.latitude}
          motoboyLng={position?.longitude}
          style={styles.mapa}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 24, color: theme.colors.text, marginBottom: theme.spacing.sm },
  prepBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: theme.spacing.sm,
  },
  prepBadgeText: { fontFamily: theme.fonts.bodySemiBold, fontSize: 12.5 },
  valorCard: { marginTop: theme.spacing.md, marginBottom: theme.spacing.md, alignItems: 'center' },
  valorLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  valor: { fontFamily: theme.fonts.heading, fontSize: 32, color: theme.colors.success, marginTop: 4 },
  card: { marginBottom: theme.spacing.md },
  label: { fontFamily: theme.fonts.bodySemiBold, fontSize: 12, color: theme.colors.accent, marginBottom: 4 },
  endereco: { fontFamily: theme.fonts.body, fontSize: 15, color: theme.colors.text, lineHeight: 20 },
  fotoPreview: { width: '100%', height: 200, borderRadius: theme.radius.md, resizeMode: 'cover' },
  codeInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  dest: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 6 },
  mapa: { height: 240, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md },
  actions: { marginTop: theme.spacing.sm, gap: theme.spacing.md },
  empty: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.xxl },
});
