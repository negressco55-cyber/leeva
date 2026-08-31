'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeOrders } from '@leeva/shared/hooks';
import {
  formatCurrencyBRL,
  ORDER_STATUS_LABELS,
  paymentPendingOnDelivery,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@leeva/shared';

type Delivery = {
  id: string;
  order_number: number | null;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string;
  latitude: number | null;
  longitude: number | null;
  order_amount: number;
  delivery_fee: number;
  driver_payout: number | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes: string | null;
  eta_min: number | null;
  eta_max: number | null;
  order_items: { name: string; quantity: number; notes: string | null }[];
  accepted: boolean;
};

const NEXT: Record<string, { to: OrderStatus; label: string; action: string }> = {
  assigned: { to: 'picked_up', label: 'Cheguei / Pedido retirado', action: 'status' },
  picked_up: { to: 'in_route', label: 'Iniciar entrega', action: 'status' },
  in_route: { to: 'delivered', label: 'Entrega concluída', action: 'status' },
};

export default function DeliveryFlow({
  motoboyId,
  restaurantId,
  deliveries,
}: {
  motoboyId: string;
  restaurantId: string | null;
  deliveries: Delivery[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const { events } = useRealtimeOrders({ motoboyId });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // realtime → recarrega, mas com debounce e nunca no meio de uma ação
  useEffect(() => {
    if (!events.length || busy) return;
    const t = setTimeout(() => start(() => router.refresh()), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length, busy]);

  if (!deliveries.length) {
    return (
      <div className="panel" style={{ textAlign: 'center' }}>
        <h1>Nenhuma entrega agora</h1>
        <p className="muted">Fique online na aba Status para receber entregas.</p>
      </div>
    );
  }

  async function call(id: string, body: unknown) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/deliveries/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível concluir a ação. Tente de novo.');
      start(() => router.refresh());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const current = deliveries[0]!;
  const rest = deliveries.slice(1);
  const step = NEXT[current.status];
  const mapUrl =
    current.latitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${current.latitude},${current.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(current.customer_address)}`;

  return (
    <div className="grid" style={{ gap: 16 }}>
      {err && <div className="panel" style={{ color: '#f87171' }}>{err}</div>}

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>Pedido #{current.order_number}</strong>
          <span className="badge">{ORDER_STATUS_LABELS[current.status]}</span>
        </div>
        <h2 style={{ margin: '8px 0 2px' }}>{current.customer_name}</h2>
        <p style={{ margin: 0 }}>{current.customer_address}</p>
        {current.eta_min != null && (
          <p className="muted" style={{ fontSize: 13 }}>
            Previsão ao cliente: {current.eta_min}–{current.eta_max} min
          </p>
        )}

        <div className="grid" style={{ margin: '12px 0' }}>
          {current.order_items.map((it, i) => (
            <div key={i}>
              {it.quantity}× {it.name}
              {it.notes ? ` — ${it.notes}` : ''}
            </div>
          ))}
        </div>

        <p style={{ margin: '4px 0' }}>
          Você recebe por esta entrega:{' '}
          <strong>{formatCurrencyBRL(Number(current.driver_payout ?? 0))}</strong>
        </p>
        {paymentPendingOnDelivery(current.payment_method, current.payment_status) &&
          Number(current.order_amount) > 0 && (
            <p style={{ margin: '4px 0', color: '#fbbf24' }}>
              💰 Receber do cliente na entrega:{' '}
              <strong>{formatCurrencyBRL(Number(current.order_amount))}</strong>
            </p>
          )}
        {current.notes && <p className="muted">Obs: {current.notes}</p>}

        <div className="grid" style={{ gap: 10, marginTop: 12 }}>
          <a className="button secondary" href={mapUrl} target="_blank" rel="noreferrer" style={{ textAlign: 'center' }}>
            🗺️ Abrir rota no mapa
          </a>
          {current.customer_phone && (
            <a className="button secondary" href={`tel:${current.customer_phone}`} style={{ textAlign: 'center' }}>
              📞 Ligar para o cliente
            </a>
          )}

          {current.status === 'assigned' && !current.accepted && (
            <button
              className="button"
              disabled={busy}
              onClick={() => call(current.id, { action: 'accept' })}
            >
              {busy ? 'Aguarde…' : 'Aceitar entrega'}
            </button>
          )}

          {step && (current.status !== 'assigned' || current.accepted) && (
            <button
              className="button"
              disabled={busy}
              onClick={() => call(current.id, { action: 'status', status: step.to })}
            >
              {busy ? 'Aguarde…' : step.label}
            </button>
          )}
        </div>
      </div>

      {rest.length > 0 && (
        <div className="panel">
          <strong>Próximas ({rest.length})</strong>
          {rest.map((d) => (
            <div key={d.id} className="muted" style={{ fontSize: 14, marginTop: 6 }}>
              #{d.order_number} — {d.customer_name} — {d.customer_address}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
