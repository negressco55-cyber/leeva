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
  expiresAt: string;
  payout: number | null;
  quality: 'excellent' | 'good' | 'acceptable' | 'poor' | null;
  countsForAcceptance: boolean;
  distancePickupKm: number | null;
  distanceTotalKm: number | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderAmount: number;
  notes: string | null;
  grouped: boolean;
  routeStops: { seq: number; address: string; region: string | null; payout: number }[] | null;
  routeTotalKm: number | null;
};

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
        const pickupEta =
          o.distancePickupKm != null ? Math.max(1, Math.round((o.distancePickupKm / 20) * 60) + 2) : null;

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
                      <span className="leg-meta">{s.seq}ª parada</span>
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
                      {pickupEta != null ? `${pickupEta} min` : 'coleta'}
                      {o.distancePickupKm != null ? ` · ${o.distancePickupKm.toFixed(1)} km` : ''}
                    </span>
                    <span className="leg-addr">{o.pickupAddress ?? o.pickupName ?? 'ponto de coleta'}</span>
                  </div>
                  <div className="offer-leg">
                    <span className="leg-dot brand" />
                    <span className="leg-meta">
                      {o.etaMinutes != null ? `${o.etaMinutes} min` : 'entrega'}
                      {totalKm != null ? ` · ${totalKm.toFixed(1)} km` : ''}
                    </span>
                    <span className="leg-addr">{o.address}</span>
                  </div>
                </div>
              )}

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
