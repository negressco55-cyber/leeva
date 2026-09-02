import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { RouteMapMini } from '../../components/RouteMapMini';
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
  const mapW = Dimensions.get('window').width;

  useEffect(() => {
    if (!offer) return;
    const tick = () => setSecs(Math.max(0, Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [offer]);

  if (!offer) return null;

  const grouped = !!offer.routeStops && offer.routeStops.length > 1;
  const totalKm = offer.distanceTotalKm ?? offer.routeTotalKm;
  const perKm = offer.payout != null && totalKm && totalKm > 0 ? offer.payout / totalKm : null;
  const pickupEta =
    offer.distancePickupKm != null ? Math.max(1, Math.round((offer.distancePickupKm / 20) * 60) + 2) : null;

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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <View style={styles.mapWrap}>
            <RouteMapMini
              pickup={offer.pickupLat != null && offer.pickupLng != null ? { lat: offer.pickupLat, lng: offer.pickupLng } : null}
              dropoff={offer.dropoffLat != null && offer.dropoffLng != null ? { lat: offer.dropoffLat, lng: offer.dropoffLng } : null}
              width={mapW}
              height={190}
            />
            <Text style={[styles.timer, secs <= 10 && styles.timerUrgent]}>{secs}s</Text>
            {!offer.countsForAcceptance && (
              <Pressable style={styles.dismiss} onPress={() => void handleDecline()} disabled={busy}>
                <Text style={styles.dismissText}>Recusar sem afetar sua taxa  ✕</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.content}>
            <View style={styles.topRow}>
              <Text style={styles.topRowText} numberOfLines={1}>
                {grouped ? `Rota — ${offer.routeStops!.length} entregas` : `Coleta · ${offer.pickupName ?? 'restaurante'}`}
              </Text>
              {offer.quality ? <Text style={styles.quality}>{qualityLabel(offer.quality)}</Text> : null}
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceNum}>{offer.payout != null ? brl(offer.payout) : '—'}</Text>
              {perKm != null && (
                <View>
                  <Text style={styles.priceKm}>{brl(perKm)}</Text>
                  <Text style={styles.priceKmLbl}>por km</Text>
                </View>
              )}
            </View>

            {grouped ? (
              <View style={styles.legs}>
                {offer.routeStops!.map((s) => (
                  <View key={s.seq} style={styles.leg}>
                    <View style={[styles.dot, styles.dotBrand]} />
                    <Text style={styles.legMeta}>{s.seq}ª parada</Text>
                    <Text style={styles.legAddr} numberOfLines={2}>{s.region ?? s.address}</Text>
                    <Text style={styles.legPay}>{brl(s.payout)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.legs}>
                <View style={styles.leg}>
                  <View style={[styles.dot, styles.dotWarn]} />
                  <Text style={styles.legMeta}>
                    {pickupEta != null ? `${pickupEta} min` : 'coleta'}
                    {offer.distancePickupKm != null ? ` · ${offer.distancePickupKm.toFixed(1)} km` : ''}
                  </Text>
                  <Text style={styles.legAddr} numberOfLines={2}>
                    {offer.pickupAddress ?? offer.pickupName ?? 'ponto de coleta'}
                  </Text>
                </View>
                <View style={styles.leg}>
                  <View style={[styles.dot, styles.dotBrand]} />
                  <Text style={styles.legMeta}>
                    {offer.etaMinutes != null ? `${offer.etaMinutes} min` : 'entrega'}
                    {totalKm != null ? ` · ${totalKm.toFixed(1)} km` : ''}
                  </Text>
                  <Text style={styles.legAddr} numberOfLines={2}>{offer.address}</Text>
                </View>
              </View>
            )}

            {offer.notes ? <Text style={styles.meta}>Obs: {offer.notes}</Text> : null}
            <Text style={styles.meta}>
              Venda: {offer.paymentMethod} · {offer.paymentStatus}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.accept, busy && styles.acceptDisabled, pressed && styles.acceptPressed]}
            onPress={() => void handleAccept()}
            disabled={busy}
          >
            <Text style={styles.acceptText}>{busy ? 'Aceitando…' : 'Aceitar'}</Text>
            <Text style={styles.acceptTimer}>{secs}s</Text>
          </Pressable>
          {offer.countsForAcceptance && (
            <Button label="Recusar" variant="outline" onPress={() => void handleDecline()} disabled={busy} style={{ marginTop: theme.spacing.sm }} />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: theme.spacing.md },
  mapWrap: { position: 'relative' },
  timer: {
    position: 'absolute', top: 12, left: 12,
    fontFamily: theme.fonts.bodySemiBold, fontSize: 13, color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: theme.radius.pill,
    paddingHorizontal: 11, paddingVertical: 3, overflow: 'hidden',
  },
  timerUrgent: { backgroundColor: theme.colors.danger },
  dismiss: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: theme.radius.pill,
    paddingHorizontal: 11, paddingVertical: 4,
  },
  dismissText: { fontFamily: theme.fonts.body, fontSize: 12, color: '#fff' },

  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  topRowText: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 },
  quality: { fontFamily: theme.fonts.bodySemiBold, fontSize: 13, color: theme.colors.textSecondary },

  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md },
  priceNum: { fontFamily: theme.fonts.heading, fontSize: 34, color: theme.colors.text, letterSpacing: -0.5 },
  priceKm: { fontFamily: theme.fonts.bodyBold, fontSize: 15, color: theme.colors.success, lineHeight: 17 },
  priceKmLbl: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textSecondary },

  legs: { gap: theme.spacing.sm },
  leg: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotWarn: { backgroundColor: theme.colors.accent },
  dotBrand: { backgroundColor: theme.colors.primary },
  legMeta: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  legAddr: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, flex: 1, minWidth: 140 },
  legPay: { fontFamily: theme.fonts.bodySemiBold, fontSize: 14, color: theme.colors.text },

  meta: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },

  actions: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  accept: {
    minHeight: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  acceptDisabled: { opacity: 0.6 },
  acceptPressed: { opacity: 0.88 },
  acceptText: { fontFamily: theme.fonts.bodySemiBold, fontSize: 17, color: theme.colors.onPrimary },
  acceptTimer: {
    fontFamily: theme.fonts.bodySemiBold, fontSize: 13, color: theme.colors.onPrimary,
    backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: theme.radius.pill,
    paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden',
  },
});
