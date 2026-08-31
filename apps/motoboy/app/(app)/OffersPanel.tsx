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

type Offer = {
  offerId: string;
  orderId: string;
  orderNumber: number | null;
  customerName: string;
  address: string;
  region: string | null;
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
};

const QUALITY_LABEL: Record<string, { text: string; color: string }> = {
  excellent: { text: '🟢 Ótima oferta', color: '#7be0a3' },
  good: { text: '🟢 Boa oferta', color: '#7be0a3' },
  acceptable: { text: '🟡 Oferta razoável', color: '#ffce85' },
  poor: { text: '⚪ Oferta pouco vantajosa', color: '#c3c8d0' },
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
              <strong>Nova entrega {o.grouped ? '(agrupada)' : ''}</strong>
              <span className={`offer-timer ${secs <= 10 ? 'urgent' : ''}`}>{secs}s</span>
            </div>
            <div className="offer-body">
              {o.quality && (
                <div style={{ fontWeight: 700, color: QUALITY_LABEL[o.quality]!.color }}>
                  {QUALITY_LABEL[o.quality]!.text}
                </div>
              )}
              <div>{o.region ?? o.address}</div>
              <div className="muted">{o.customerName} · {o.address}</div>
              {(o.distancePickupKm != null || o.distanceTotalKm != null) && (
                <div className="muted" style={{ fontSize: 13 }}>
                  {o.distancePickupKm != null ? `${o.distancePickupKm.toFixed(1)} km até a coleta` : ''}
                  {o.distanceTotalKm != null ? ` · ${o.distanceTotalKm.toFixed(1)} km no total` : ''}
                </div>
              )}
              {o.payout != null && (
                <div className="offer-pay">Você recebe <strong>{formatCurrencyBRL(o.payout)}</strong></div>
              )}
              <div className="muted" style={{ fontSize: 12 }}>
                {o.countsForAcceptance
                  ? 'Recusar esta oferta conta na sua taxa de aceitação.'
                  : 'Recusar esta oferta não afeta sua reputação.'}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                Pagamento da venda: {PAYMENT_METHOD_LABELS[o.paymentMethod]} —{' '}
                {PAYMENT_STATUS_LABELS[o.paymentStatus]}
              </div>
              {collectOnDelivery && (
                <div className="offer-collect">
                  💰 Receber do cliente na entrega: {formatCurrencyBRL(o.orderAmount)}
                </div>
              )}
              {o.notes && <div className="muted" style={{ fontSize: 13 }}>Obs: {o.notes}</div>}
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
