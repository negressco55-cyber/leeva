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
};

/** Redimensiona a foto no navegador antes de enviar (máx 1280px, JPEG ~0.7). */
function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagem inválida'));
    };
    img.src = url;
  });
}

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
    );
  });
}

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
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

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

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoErr(null);
    try {
      setPhoto(await resizePhoto(file));
    } catch {
      setPhotoErr('Não consegui usar essa foto. Tente de novo.');
    }
  }

  async function confirmDelivery(id: string) {
    if (!photo) return;
    setBusy(true);
    setErr(null);
    try {
      const pos = await getPosition();
      const res = await fetch(`/api/deliveries/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'deliver', photoBase64: photo, lat: pos?.lat ?? null, lng: pos?.lng ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível confirmar a entrega.');
      setPhoto(null);
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
      {err && <div className="panel" style={{ color: 'var(--danger)' }}>{err}</div>}

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
            <p style={{ margin: '4px 0', color: 'var(--warn)' }}>
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

          {current.status === 'in_route' && (
            <div className="grid" style={{ gap: 8 }}>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Para concluir, tire uma foto da entrega (porta, portaria ou o pedido no local).
                Você precisa estar no endereço.
              </p>
              {!photo ? (
                <label className="button secondary" style={{ textAlign: 'center', cursor: 'pointer' }}>
                  Tirar foto da entrega
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => onPickPhoto(e.target.files?.[0])}
                  />
                </label>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt="Foto da entrega"
                    style={{ width: '100%', borderRadius: 10, maxHeight: 260, objectFit: 'cover' }}
                  />
                  <button className="button ghost" type="button" disabled={busy} onClick={() => setPhoto(null)}>
                    Tirar outra
                  </button>
                  <button className="button" disabled={busy} onClick={() => confirmDelivery(current.id)}>
                    {busy ? 'Confirmando…' : 'Confirmar entrega'}
                  </button>
                </>
              )}
              {photoErr && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{photoErr}</p>}
            </div>
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
