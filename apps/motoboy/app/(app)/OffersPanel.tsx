'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLeevaBrowserClient } from '@leeva/shared/client';
import {
  formatCurrencyBRL,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  paymentPendingOnDelivery,
  type PaymentMethod,
  type PaymentStatus,
} from '@leeva/shared';
import { computePrepStatus } from '@leeva/shared/services/prep-status';
import RouteMap from './_lib/RouteMap';

type Offer = {
  offerId: string;
  orderId: string;
  orderNumber: number | null;
  customerName: string;
  address: string;
  region: string | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  pickupName: string | null;
  pickupAddress: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  etaMinutes: number | null;
  etaPickupMinutes: number | null;
  etaDropoffMinutes: number | null;
  expiresAt: string;
  payout: number | null;
  quality: 'excellent' | 'good' | 'acceptable' | 'poor' | null;
  countsForAcceptance: boolean;
  distancePickupKm: number | null;
  distanceDropoffKm: number | null;
  distanceTotalKm: number | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderAmount: number;
  notes: string | null;
  readyAt: string | null;
  preparingAt: string | null;
  prepEstimateMinutes: number | null;
  grouped: boolean;
  routeStops: { seq: number; address: string; region: string | null; payout: number; legKm: number | null }[] | null;
  routeTotalKm: number | null;
};

function prepBadge(o: Pick<Offer, 'readyAt' | 'preparingAt' | 'prepEstimateMinutes'>): { text: string; color: string } | null {
  const p = computePrepStatus({ readyAt: o.readyAt, preparingAt: o.preparingAt, prepEstimateMinutes: o.prepEstimateMinutes });
  if (p.state === 'ready') return { text: p.label, color: 'var(--ok)' };
  if (p.state === 'preparing') return { text: p.label, color: 'var(--warn)' };
  return null;
}

let offerAudioCtx: AudioContext | null = null;

/** Bipe de duas notas ao chegar oferta — sem depender de arquivo de áudio.
 *  Navegador só libera som depois de alguma interação do usuário na página;
 *  se ainda não houve, falha em silêncio (a vibração continua funcionando). */
function playOfferSound(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!offerAudioCtx) offerAudioCtx = new Ctx();
    const ctx = offerAudioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    [880, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    /* ambiente sem áudio (ex.: preview em SSR) — ignora */
  }
}

const QUALITY_LABEL: Record<string, { text: string; color: string }> = {
  excellent: { text: '🟢 Ótima oferta', color: 'var(--ok)' },
  good: { text: '🟢 Boa oferta', color: 'var(--ok)' },
  acceptable: { text: '🟡 Oferta razoável', color: 'var(--warn)' },
  poor: { text: '⚪ Oferta pouco vantajosa', color: 'var(--muted)' },
};

/**
 * Ofertas de entrega — aparecem em qualquer tela do app enquanto houver
 * uma pendente. O motoboy só aceita ou recusa. Countdown até expirar.
 */
export default function OffersPanel({ motoboyId }: { motoboyId: string }) {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/offers', { cache: 'no-store' });
      if (res.ok) {
        const d = (await res.json()) as { offers: Offer[] };
        setOffers(d.offers);
        for (const o of d.offers) {
          if (!seen.current.has(o.offerId)) {
            seen.current.add(o.offerId);
            try {
              navigator.vibrate?.(300);
            } catch {
              /* ok */
            }
            playOfferSound();
          }
        }
      }
    } catch {
      /* rede — próximo ciclo */
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const supabase = createLeevaBrowserClient();
    const ch = supabase
      .channel(`offers-${motoboyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispatch_attempts', filter: `motoboy_id=eq.${motoboyId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      clearInterval(iv);
      clearInterval(clock);
      supabase.removeChannel(ch);
    };
  }, [load, motoboyId]);

  async function respond(offerId: string, action: 'accept' | 'decline') {
    setBusy(offerId);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setOffers((o) => o.filter((x) => x.offerId !== offerId));
      if (res.ok && action === 'accept') {
        router.push('/entrega');
        router.refresh();
      }
    } finally {
      setBusy(null);
      load();
    }
  }

  const active = offers.filter((o) => new Date(o.expiresAt).getTime() > now);
  if (!active.length) return null;

  return (
    <div className="offers-overlay">
      {active.map((o) => {
        const secs = Math.max(0, Math.round((new Date(o.expiresAt).getTime() - now) / 1000));
        const collectOnDelivery = paymentPendingOnDelivery(o.paymentMethod, o.paymentStatus);
        const grouped = !!o.routeStops && o.routeStops.length > 1;
        const totalKm = o.distanceTotalKm ?? o.routeTotalKm;
        const perKm = o.payout != null && totalKm && totalKm > 0 ? o.payout / totalKm : null;
        const pickupEta = o.etaPickupMinutes;
        const dropoffEta = o.etaDropoffMinutes ?? o.etaMinutes;

        return (
          <div key={o.offerId} className="offer-card">
            <div className="offer-map-wrap">
              <RouteMap
                pickup={o.pickupLat != null && o.pickupLng != null ? { lat: o.pickupLat, lng: o.pickupLng } : null}
                dropoff={o.dropoffLat != null && o.dropoffLng != null ? { lat: o.dropoffLat, lng: o.dropoffLng } : null}
                height={148}
              />
              <span className={`offer-timer ${secs <= 10 ? 'urgent' : ''}`}>{secs}s</span>
              {!o.countsForAcceptance && (
                <button
                  className="offer-dismiss"
                  disabled={busy === o.offerId}
                  onClick={() => respond(o.offerId, 'decline')}
                >
                  Recusar sem afetar sua taxa ✕
                </button>
              )}
            </div>

            <div className="offer-content">
              <div className="offer-toprow">
                <span className="muted">
                  {grouped ? `Rota — ${o.routeStops!.length} entregas` : `Coleta · ${o.pickupName ?? 'restaurante'}`}
                </span>
                {o.quality && (
                  <span className="offer-quality" style={{ color: QUALITY_LABEL[o.quality]!.color }}>
                    {QUALITY_LABEL[o.quality]!.text}
                  </span>
                )}
              </div>

              <div className="offer-price">
                <span className="offer-price-num">
                  {o.payout != null ? formatCurrencyBRL(o.payout) : '—'}
                </span>
                {perKm != null && (
                  <span className="offer-price-km">{formatCurrencyBRL(perKm)}<i>por km</i></span>
                )}
              </div>

              {grouped ? (
                <div className="offer-legs">
                  {o.routeStops!.map((s) => (
                    <div key={s.seq} className="offer-leg">
                      <span className="leg-dot brand" />
                      <span className="leg-meta">
                        {s.seq}ª parada
                        {s.legKm != null
                          ? ` · ${s.legKm.toFixed(1)} km ${s.seq === 1 ? 'da coleta' : 'da parada anterior'}`
                          : ''}
                      </span>
                      <span className="leg-addr">{s.region ?? s.address}</span>
                      <span className="leg-pay">{formatCurrencyBRL(s.payout)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="offer-legs">
                  <div className="offer-leg">
                    <span className="leg-dot warn" />
                    <span className="leg-meta">
                      {pickupEta != null ? `~${pickupEta} min até a coleta` : 'coleta'}
                      {o.distancePickupKm != null ? ` · ${o.distancePickupKm.toFixed(1)} km` : ''}
                    </span>
                    <span className="leg-addr">{o.pickupAddress ?? o.pickupName ?? 'ponto de coleta'}</span>
                  </div>
                  <div className="offer-leg">
                    <span className="leg-dot brand" />
                    <span className="leg-meta">
                      {dropoffEta != null ? `~${dropoffEta} min até a entrega` : 'entrega'}
                      {o.distanceDropoffKm != null ? ` · ${o.distanceDropoffKm.toFixed(1)} km` : ''}
                    </span>
                    <span className="leg-addr">{o.address}</span>
                  </div>
                </div>
              )}

              {(() => {
                const pb = prepBadge(o);
                return pb ? <div className="muted" style={{ fontSize: 12.5, color: pb.color, fontWeight: 600 }}>{pb.text}</div> : null;
              })()}
              {collectOnDelivery && (
                <div className="offer-collect">
                  💰 Receber do cliente na entrega: {formatCurrencyBRL(o.orderAmount)}
                </div>
              )}
              {o.notes && <div className="muted" style={{ fontSize: 13 }}>Obs: {o.notes}</div>}
              <div className="muted" style={{ fontSize: 12.5 }}>
                Venda: {PAYMENT_METHOD_LABELS[o.paymentMethod]} — {PAYMENT_STATUS_LABELS[o.paymentStatus]}
              </div>

              <button
                className="offer-accept"
                disabled={busy === o.offerId}
                onClick={() => respond(o.offerId, 'accept')}
              >
                <span>{busy === o.offerId ? 'Aceitando…' : 'Aceitar'}</span>
                <span className="offer-accept-timer">{secs}s</span>
              </button>
              {o.countsForAcceptance && (
                <button
                  className="offer-decline-text"
                  disabled={busy === o.offerId}
                  onClick={() => respond(o.offerId, 'decline')}
                >
                  Recusar
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
