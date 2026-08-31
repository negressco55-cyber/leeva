'use client';

import { useState } from 'react';
import { apiGet, apiPost } from '../_lib/client';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type PaymentMethod, type PaymentStatus } from '@leeva/shared';

/**
 * Nova entrega — o Leeva recebe só os dados LOGÍSTICOS. Itens são opcionais.
 * Ao criar, o despacho automático começa a procurar entregador na hora.
 */
export default function NewOrderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [orderValue, setOrderValue] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('unknown');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function geocode() {
    if (address.trim().length < 5) return;
    setGeocoding(true);
    setGeoLabel(null);
    try {
      const r = await apiGet<{ ok: boolean; latitude?: number; longitude?: number; label?: string; error?: string }>(
        `/api/geocode?q=${encodeURIComponent(address)}`,
      );
      if (r.ok && r.latitude != null) {
        setLat(String(r.latitude));
        setLng(String(r.longitude));
        setGeoLabel(r.label ?? 'Localizado');
      } else {
        setGeoLabel(r.error ?? 'não encontrado — informe lat/lng manualmente');
      }
    } catch {
      setGeoLabel('falha na busca');
    } finally {
      setGeocoding(false);
    }
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await apiPost('/api/orders', {
        customerName,
        customerPhone: customerPhone || null,
        address,
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
        deliveryFee: deliveryFee ? Number(deliveryFee) : 0,
        total: orderValue ? Number(orderValue) : 0,
        paymentMethod,
        paymentStatus,
        notes: notes || null,
        items: [],
      });
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Nova entrega</h2>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          O Leeva encontra o entregador automaticamente ao criar.
        </p>

        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          <input className="input" placeholder="Nome do cliente *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className="input" placeholder="Telefone (WhatsApp) — para o rastreamento" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          <input className="input" placeholder="Endereço de entrega *" value={address} onChange={(e) => setAddress(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn sm" onClick={geocode} disabled={geocoding || address.trim().length < 5}>
              {geocoding ? 'Buscando…' : '📍 Localizar no mapa'}
            </button>
            {geoLabel && <span className="muted" style={{ fontSize: 12 }}>{geoLabel}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} style={{ flex: 1 }} />
            <input className="input" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} style={{ flex: 1 }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="number" step="0.01" placeholder="Valor do pedido (R$)" value={orderValue} onChange={(e) => setOrderValue(e.target.value)} style={{ flex: 1 }} />
            <input className="input" type="number" step="0.01" placeholder="Taxa de entrega (R$)" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} style={{ flex: 1 }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} style={{ flex: 1 }}>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>Pagamento: {PAYMENT_METHOD_LABELS[m]}</option>
              ))}
            </select>
            <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)} style={{ flex: 1 }}>
              {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => (
                <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <textarea className="input" placeholder="Observações de entrega" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

          {err && <div className="op-alert critical">{err}</div>}

          <button className="btn primary" onClick={submit} disabled={busy || !customerName.trim() || !address.trim()}>
            {busy ? 'Criando…' : 'Criar e buscar entregador'}
          </button>
        </div>
      </div>
    </div>
  );
}
