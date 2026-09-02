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
import RouteMini from './_lib/RouteMini';

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
        return (
          <div key={o.offerId} className="offer-card">
            <div className="offer-head">
              <strong>
                {o.routeStops && o.routeStops.length > 1
                  ? `Nova rota — ${o.routeStops.length} entregas`
                  : 'Nova entrega'}
              </strong>
              <span className={`offer-timer ${secs <= 10 ? 'urgent' : ''}`}>{secs}s</span>
            </div>

            {/* valor em destaque, no topo — a primeira coisa que o motoboy vê */}
            <div className="offer-value">
              <span className="offer-value-num">
                {o.payout != null ? formatCurrencyBRL(o.payout) : '—'}
              </span>
              <span className="offer-value-lbl">você recebe</span>
              {o.quality && (
                <span className="offer-quality" style={{ color: QUALITY_LABEL[o.quality]!.color }}>
                  {QUALITY_LABEL[o.quality]!.text}
                </span>
              )}
            </div>

            {/* prévia da rota */}
            <RouteMini
              pickup={o.pickupLat != null && o.pickupLng != null ? { lat: o.pickupLat, lng: o.pickupLng } : null}
              dropoff={o.dropoffLat != null && o.dropoffLng != null ? { lat: o.dropoffLat, lng: o.dropoffLng } : null}
              pickupKm={o.distancePickupKm}
              totalKm={o.distanceTotalKm ?? o.routeTotalKm}
            />

            {/* dados em linha/ícone */}
            <div className="offer-chips">
              {o.distancePickupKm != null && (
                <span className="offer-chip">🛵 {o.distancePickupKm.toFixed(1)} km até você</span>
              )}
              {(o.distanceTotalKm ?? o.routeTotalKm) != null && (
                <span className="offer-chip">📍 {(o.distanceTotalKm ?? o.routeTotalKm)!.toFixed(1)} km no total</span>
              )}
              {o.etaMinutes != null && <span className="offer-chip">⏱ ~{o.etaMinutes} min</span>}
              {o.routeStops && o.routeStops.length > 1 && (
                <span className="offer-chip">🔁 {o.routeStops.length} paradas</span>
              )}
            </div>

            <div className="offer-body">
              {o.routeStops && o.routeStops.length > 1 ? (
                <div className="route-stops">
                  {o.routeStops.map((s) => (
                    <div
                      key={s.seq}
                      style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}
                    >
                      <span>
                        <strong>{s.seq}ª</strong> {s.region ?? s.address}
                      </span>
                      <span>{formatCurrencyBRL(s.payout)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600 }}>{o.region ?? o.address}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{o.customerName} · {o.address}</div>
                  {o.pickupName && (
                    <div className="muted" style={{ fontSize: 13 }}>Coleta: {o.pickupName}</div>
                  )}
                </div>
              )}
              <div className="muted" style={{ fontSize: 13 }}>
                Venda: {PAYMENT_METHOD_LABELS[o.paymentMethod]} — {PAYMENT_STATUS_LABELS[o.paymentStatus]}
              </div>
              {collectOnDelivery && (
                <div className="offer-collect">
                  💰 Receber do cliente na entrega: {formatCurrencyBRL(o.orderAmount)}
                </div>
              )}
              {o.notes && <div className="muted" style={{ fontSize: 13 }}>Obs: {o.notes}</div>}
              <div className="muted" style={{ fontSize: 12 }}>
                {o.countsForAcceptance
                  ? 'Recusar esta oferta conta na sua taxa de aceitação.'
                  : 'Recusar não afeta sua reputação.'}
              </div>
            </div>
            <div className="offer-actions">
              <button
                className="button secondary"
                disabled={busy === o.offerId}
                onClick={() => respond(o.offerId, 'decline')}
              >
                Recusar
              </button>
              <button
                className="button"
                disabled={busy === o.offerId}
                onClick={() => respond(o.offerId, 'accept')}
              >
                {busy === o.offerId ? '…' : 'Aceitar'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
