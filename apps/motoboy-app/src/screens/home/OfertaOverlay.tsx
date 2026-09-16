import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { RouteMapMini } from '../../components/RouteMapMini';
import { useRide } from '../../context/RideContext';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/theme';

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;
const qualityLabel = (q: string): string =>
  q === 'excellent' ? '🟢 Ótima oferta'
  : q === 'good' ? '🟢 Boa oferta'
  : q === 'acceptable' ? '🟡 Oferta razoável'
  : '⚪ Oferta pouco vantajosa';

export function OfertaOverlay(): React.JSX.Element | null {
  const t = useTheme();
  const styles = makeStyles(t);
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
  const pickupEta = offer.etaPickupMinutes;
  const dropoffEta = offer.etaDropoffMinutes ?? offer.etaMinutes;

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
                      <Text style={styles.legMeta}>
                        {s.seq}ª parada
                        {s.legKm != null ? ` · ${s.legKm.toFixed(1)} km ${s.seq === 1 ? 'da coleta' : 'da parada anterior'}` : ''}
                      </Text>
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
                      {pickupEta != null ? `~${pickupEta} min até a coleta` : 'Coleta'}
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
                      {dropoffEta != null ? `~${dropoffEta} min até a entrega` : 'Entrega'}
                      {offer.distanceDropoffKm != null ? ` · ${offer.distanceDropoffKm.toFixed(1)} km` : ''}
                    </Text>
                    <Text style={styles.legAddr} numberOfLines={2}>{offer.address}</Text>
                  </View>
                </View>
              </View>
            )}

            {offer.notes ? <Text style={styles.meta}>Obs: {offer.notes}</Text> : null}
            <View style={styles.paymentChip}>
              <Text style={styles.paymentChipText}>
                💰 {offer.paymentMethod} · {offer.paymentStatus}
              </Text>
            </View>
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
            <Button label="Recusar" variant="outline" onPress={() => void handleDecline()} disabled={busy} style={{ marginTop: t.spacing.sm }} />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { paddingBottom: t.spacing.md },

    timeBarTrack: { height: 4, backgroundColor: t.colors.border },
    timeBarFill: { height: 4, backgroundColor: t.colors.primary },
    timeBarUrgent: { backgroundColor: t.colors.danger },

    mapWrap: { position: 'relative' },
    timer: {
      position: 'absolute', top: 12, left: 12,
      fontFamily: t.fonts.bodySemiBold, fontSize: 12, color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: t.radius.pill,
      paddingHorizontal: 11, paddingVertical: 3, overflow: 'hidden',
    },
    timerUrgent: { backgroundColor: t.colors.danger },
    dismiss: {
      position: 'absolute', top: 12, right: 12,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: t.radius.pill,
      paddingHorizontal: 11, paddingVertical: 4,
    },
    dismissText: { fontFamily: t.fonts.body, fontSize: 12, color: '#fff' },

    priceCard: {
      position: 'absolute',
      left: t.spacing.md,
      right: t.spacing.md,
      bottom: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      padding: t.spacing.md,
      gap: 6,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },

    content: { padding: t.spacing.lg, gap: t.spacing.md },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.sm },
    topRowText: { fontFamily: t.fonts.body, fontSize: 13, color: t.colors.textSecondary, flexShrink: 1 },
    quality: { fontFamily: t.fonts.bodySemiBold, fontSize: 12, color: t.colors.textSecondary },

    priceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: t.spacing.md },
    priceNum: { fontFamily: t.fonts.heading, fontSize: 38, color: t.colors.success, letterSpacing: -0.5 },

    legs: { gap: t.spacing.sm },
    leg: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm },
    legConnector: { width: 1, height: 14, backgroundColor: t.colors.border, marginLeft: 13 },
    legBadge: {
      width: 26, height: 26, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.colors.primary,
    },
    legBadgePickup: { backgroundColor: t.colors.accent },
    legBadgeDrop: { backgroundColor: t.colors.primary },
    legBadgeLabel: { fontFamily: t.fonts.bodySemiBold, fontSize: 12, color: '#fff' },
    legTextCol: { flex: 1, minWidth: 140 },
    legMeta: { fontFamily: t.fonts.body, fontSize: 12, color: t.colors.textSecondary },
    legAddr: { fontFamily: t.fonts.body, fontSize: 14, color: t.colors.text, marginTop: 2 },
    legPay: { fontFamily: t.fonts.bodySemiBold, fontSize: 14, color: t.colors.text },

    meta: { fontFamily: t.fonts.body, fontSize: 12, color: t.colors.textSecondary },
    paymentChip: {
      alignSelf: 'flex-start',
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    paymentChipText: { fontFamily: t.fonts.bodySemiBold, fontSize: 13, color: t.colors.text },

    actions: {
      padding: t.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    accept: {
      minHeight: 56,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.primary,
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
    acceptText: { fontFamily: t.fonts.bodySemiBold, fontSize: 16, color: t.colors.onPrimary },
    acceptTimer: {
      fontFamily: t.fonts.bodySemiBold, fontSize: 13, color: t.colors.onPrimary,
      backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: t.radius.pill,
      paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden',
    },
  });
}
