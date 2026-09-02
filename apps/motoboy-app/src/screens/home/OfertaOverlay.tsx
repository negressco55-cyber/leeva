import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { RotaMini } from '../../components/RotaMini';
import { useRide } from '../../context/RideContext';
import { theme } from '../../theme/theme';

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;
const qualityLabel = (q: string): string =>
  q === 'excellent' ? '🟢 Ótima oferta'
  : q === 'good' ? '🟢 Boa oferta'
  : q === 'acceptable' ? '🟡 Oferta razoável'
  : '⚪ Oferta pouco vantajosa';

export function OfertaOverlay(): React.JSX.Element | null {
  const { offer, acceptOffer, declineOffer } = useRide();
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!offer) return;
    const tick = () => setSecs(Math.max(0, Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [offer]);

  if (!offer) return null;

  const grouped = !!offer.routeStops && offer.routeStops.length > 1;

  async function handleAccept(): Promise<void> {
    setBusy(true);
    await acceptOffer();
    setBusy(false);
  }
  async function handleDecline(): Promise<void> {
    setBusy(true);
    await declineOffer();
    setBusy(false);
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{grouped ? `Nova rota — ${offer.routeStops!.length} entregas` : 'Nova entrega'}</Text>
          <Text style={[styles.timer, secs <= 10 && styles.timerUrgent]}>{secs}s</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Card style={styles.valorCard}>
            <Text style={styles.valorLabel}>Você recebe</Text>
            <Text style={styles.valor}>{offer.payout != null ? brl(offer.payout) : '—'}</Text>
            {offer.quality ? <Text style={styles.qualidade}>{qualityLabel(offer.quality)}</Text> : null}
          </Card>

          <RotaMini
            pickup={
              offer.pickupLat != null && offer.pickupLng != null
                ? { lat: offer.pickupLat, lng: offer.pickupLng }
                : null
            }
            dropoff={
              offer.dropoffLat != null && offer.dropoffLng != null
                ? { lat: offer.dropoffLat, lng: offer.dropoffLng }
                : null
            }
            pickupKm={offer.distancePickupKm}
            totalKm={offer.distanceTotalKm ?? offer.routeTotalKm}
          />

          <View style={styles.chips}>
            {offer.distancePickupKm != null && (
              <Text style={styles.chip}>🛵 {offer.distancePickupKm.toFixed(1)} km até você</Text>
            )}
            {(offer.distanceTotalKm ?? offer.routeTotalKm) != null && (
              <Text style={styles.chip}>📍 {(offer.distanceTotalKm ?? offer.routeTotalKm)!.toFixed(1)} km no total</Text>
            )}
            {offer.etaMinutes != null && <Text style={styles.chip}>⏱ ~{offer.etaMinutes} min</Text>}
            {grouped && <Text style={styles.chip}>🔁 {offer.routeStops!.length} paradas</Text>}
          </View>

          {grouped ? (
            <Card style={styles.card}>
              <Text style={styles.label}>Paradas</Text>
              {offer.routeStops!.map((s) => (
                <View key={s.seq} style={styles.stopRow}>
                  <Text style={styles.stopText}>
                    {s.seq}ª · {s.region ?? s.address}
                  </Text>
                  <Text style={styles.stopValue}>{brl(s.payout)}</Text>
                </View>
              ))}
            </Card>
          ) : (
            <Card style={styles.card}>
              <Text style={styles.label}>Entrega</Text>
              <Text style={styles.endereco}>{offer.address}</Text>
              <Text style={styles.dest}>{offer.customerName}</Text>
            </Card>
          )}

          {offer.distancePickupKm != null && (
            <Text style={styles.meta}>{offer.distancePickupKm.toFixed(1)} km até a coleta</Text>
          )}
          {offer.notes ? <Text style={styles.meta}>Obs: {offer.notes}</Text> : null}
          <Text style={styles.meta}>
            {offer.countsForAcceptance
              ? 'Recusar conta na sua taxa de aceitação.'
              : 'Recusar esta oferta não afeta sua reputação.'}
          </Text>
        </ScrollView>

        <View style={styles.actions}>
          <Button label="Recusar" variant="outline" onPress={() => void handleDecline()} disabled={busy} style={styles.flex} />
          <Button label="Aceitar" onPress={() => void handleAccept()} loading={busy} style={styles.flex} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg, paddingTop: theme.spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  eyebrow: { fontFamily: theme.fonts.headingSemiBold, fontSize: 20, color: theme.colors.primary, flex: 1 },
  timer: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.text },
  timerUrgent: { color: theme.colors.danger },
  body: { paddingBottom: theme.spacing.md },
  valorCard: { alignItems: 'center', marginBottom: theme.spacing.md },
  valorLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  valor: { fontFamily: theme.fonts.heading, fontSize: 40, color: theme.colors.success, marginTop: 4 },
  qualidade: { fontFamily: theme.fonts.bodySemiBold, fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: theme.spacing.md },
  chip: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  card: { marginBottom: theme.spacing.md },
  label: { fontFamily: theme.fonts.bodySemiBold, fontSize: 12, color: theme.colors.accent, marginBottom: 6 },
  endereco: { fontFamily: theme.fonts.body, fontSize: 15, color: theme.colors.text, lineHeight: 20 },
  dest: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 6 },
  stopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 6 },
  stopText: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, flex: 1 },
  stopValue: { fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 6 },
  actions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  flex: { flex: 1 },
});
