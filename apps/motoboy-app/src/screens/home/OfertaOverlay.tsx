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
  const [totalSecs, setTotalSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const win = Dimensions.get('window');
  const mapW = win.width;
  const mapH = Math.round(win.height * 0.4);

  useEffect(() => {
    if (!offer) return;
    setTotalSecs(Math.max(1, Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));
    const tick = () => setSecs(Math.max(0, Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [offer]);

  if (!offer) return null;

  const timeLeftPct = totalSecs > 0 ? Math.max(0, Math.min(1, secs / totalSecs)) : 0;

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
        <View style={styles.timeBarTrack}>
          <View style={[styles.timeBarFill, { width: `${timeLeftPct * 100}%` }, secs <= 10 && styles.timeBarUrgent]} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <View style={styles.mapWrap}>
            <RouteMapMini
              pickup={offer.pickupLat != null && offer.pickupLng != null ? { lat: offer.pickupLat, lng: offer.pickupLng } : null}
              dropoff={offer.dropoffLat != null && offer.dropoffLng != null ? { lat: offer.dropoffLat, lng: offer.dropoffLng } : null}
              width={mapW}
              height={mapH}
            />
            <Text style={[styles.timer, secs <= 10 && styles.timerUrgent]}>Expira em {secs}s</Text>
            {!offer.countsForAcceptance && (
              <Pressable style={styles.dismiss} onPress={() => void handleDecline()} disabled={busy}>
                <Text style={styles.dismissText}>Recusar sem afetar sua taxa  ✕</Text>
              </Pressable>
            )}

            <View style={styles.priceCard}>
              <View style={styles.topRow}>
                <Text style={styles.topRowText} numberOfLines={1}>
                  {grouped ? `Rota — ${offer.routeStops!.length} entregas` : `Coleta · ${offer.pickupName ?? 'restaurante'}`}
                </Text>
                {offer.quality ? <Text style={styles.quality}>{qualityLabel(offer.quality)}</Text> : null}
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceNum}>{offer.payout != null ? brl(offer.payout) : '—'}</Text>
                <View style={styles.priceSub}>
                  {totalKm != null && <Text style={styles.priceKmTotal}>{totalKm.toFixed(1)} km no total</Text>}
                  {perKm != null && <Text style={styles.priceKmLbl}>{brl(perKm)} por km</Text>}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.content}>
            {grouped ? (
              <View style={styles.legs}>
                {offer.routeStops!.map((s, i) => (
                  <View key={s.seq} style={styles.leg}>
                    <View style={styles.legBadge}>
                      <Text style={styles.legBadgeLabel}>{i === 0 ? 'A' : String.fromCharCode(65 + i)}</Text>
                    </View>
                    <View style={styles.legTextCol}>
                      <Text style={styles.legMeta}>{s.seq}ª parada</Text>
                      <Text style={styles.legAddr} numberOfLines={2}>{s.region ?? s.address}</Text>
                    </View>
                    <Text style={styles.legPay}>{brl(s.payout)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.legs}>
                <View style={styles.leg}>
                  <View style={[styles.legBadge, styles.legBadgePickup]}>
                    <Text style={styles.legBadgeLabel}>A</Text>
                  </View>
                  <View style={styles.legTextCol}>
                    <Text style={styles.legMeta}>
                      Coleta{pickupEta != null ? ` · ${pickupEta} min` : ''}
                      {offer.distancePickupKm != null ? ` · ${offer.distancePickupKm.toFixed(1)} km` : ''}
                    </Text>
                    <Text style={styles.legAddr} numberOfLines={2}>
                      {offer.pickupAddress ?? offer.pickupName ?? 'ponto de coleta'}
                    </Text>
                  </View>
                </View>
                <View style={styles.legConnector} />
                <View style={styles.leg}>
                  <View style={[styles.legBadge, styles.legBadgeDrop]}>
                    <Text style={styles.legBadgeLabel}>B</Text>
                  </View>
                  <View style={styles.legTextCol}>
                    <Text style={styles.legMeta}>
                      Entrega{offer.etaMinutes != null ? ` · ${offer.etaMinutes} min` : ''}
                      {totalKm != null ? ` · ${totalKm.toFixed(1)} km` : ''}
                    </Text>
                    <Text style={styles.legAddr} numberOfLines={2}>{offer.address}</Text>
                  </View>
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
            <View style={styles.acceptInnerBarTrack}>
              <View style={[styles.acceptInnerBarFill, { width: `${timeLeftPct * 100}%` }]} />
            </View>
            <Text style={styles.acceptText}>{busy ? 'Aceitando…' : `Aceitar · ${offer.payout != null ? brl(offer.payout) : '—'}`}</Text>
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

  timeBarTrack: { height: 4, backgroundColor: theme.colors.border },
  timeBarFill: { height: 4, backgroundColor: theme.colors.primary },
  timeBarUrgent: { backgroundColor: theme.colors.danger },

  mapWrap: { position: 'relative' },
  timer: {
    position: 'absolute', top: 12, left: 12,
    fontFamily: theme.fonts.bodySemiBold, fontSize: 12, color: '#fff',
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

  priceCard: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  topRowText: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 },
  quality: { fontFamily: theme.fonts.bodySemiBold, fontSize: 12, color: theme.colors.textSecondary },

  priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: theme.spacing.md },
  priceNum: { fontFamily: theme.fonts.heading, fontSize: 32, color: theme.colors.text, letterSpacing: -0.5 },
  priceSub: { alignItems: 'flex-end' },
  priceKmTotal: { fontFamily: theme.fonts.bodySemiBold, fontSize: 13, color: theme.colors.text },
  priceKmLbl: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.success, marginTop: 2 },

  legs: { gap: theme.spacing.sm },
  leg: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  legConnector: { width: 1, height: 14, backgroundColor: theme.colors.border, marginLeft: 13 },
  legBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  legBadgePickup: { backgroundColor: theme.colors.accent },
  legBadgeDrop: { backgroundColor: theme.colors.primary },
  legBadgeLabel: { fontFamily: theme.fonts.bodySemiBold, fontSize: 12, color: '#fff' },
  legTextCol: { flex: 1, minWidth: 140 },
  legMeta: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  legAddr: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, marginTop: 2 },
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
    overflow: 'hidden',
    position: 'relative',
  },
  acceptInnerBarTrack: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: 'transparent',
  },
  acceptInnerBarFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  acceptDisabled: { opacity: 0.6 },
  acceptPressed: { opacity: 0.88 },
  acceptText: { fontFamily: theme.fonts.bodySemiBold, fontSize: 16, color: theme.colors.onPrimary },
  acceptTimer: {
    fontFamily: theme.fonts.bodySemiBold, fontSize: 13, color: theme.colors.onPrimary,
    backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: theme.radius.pill,
    paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden',
  },
});
