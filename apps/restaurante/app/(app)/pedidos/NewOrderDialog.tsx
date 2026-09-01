'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../_lib/client';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatCurrencyBRL,
  paymentPendingOnDelivery,
  type PaymentMethod,
  type PaymentStatus,
} from '@leeva/shared';

type FeePreview = {
  ok: boolean;
  distanceKm?: number | null;
  driverPayout?: number;
  margin?: number;
  total?: number;
  balance?: number;
  sufficient?: boolean;
  error?: string;
};

/**
 * Nova entrega — o restaurante informa só o endereço. O Leeva calcula a taxa
 * automaticamente (distância) e mostra ANTES de criar. Sem taxa surpresa.
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fee, setFee] = useState<FeePreview | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const collectOnDelivery = paymentPendingOnDelivery(paymentMethod, paymentStatus);

  // pré-visualização da taxa sempre que a localização mudar
  useEffect(() => {
    if (!lat || !lng) {
      setFee(null);
      return;
    }
    let cancelled = false;
    apiGet<FeePreview>(`/api/delivery-fee?latitude=${lat}&longitude=${lng}`)
      .then((r) => !cancelled && setFee(r))
      .catch(() => !cancelled && setFee(null));
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

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
        total: collectOnDelivery && orderValue ? Number(orderValue) : 0,
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
          O Leeva calcula a taxa pela distância e encontra o entregador automaticamente.
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

          {/* pré-visualização da taxa */}
          {fee?.ok && fee.total != null && (
            <div className="op-alert info" style={{ marginBottom: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                Esta entrega vai custar {formatCurrencyBRL(fee.total)}
                {fee.distanceKm != null && (
                  <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> · {fee.distanceKm} km</span>
                )}
              </div>
              <button
                type="button"
                className="btn sm"
                style={{ marginTop: 6 }}
                onClick={() => setShowDetail((s) => !s)}
              >
                {showDetail ? 'ocultar detalhe' : 'ver detalhe'}
              </button>
              {showDetail && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Entregador: {formatCurrencyBRL(fee.driverPayout ?? 0)} (100% pela distância)<br />
                  Leeva: {formatCurrencyBRL(fee.margin ?? 0)} (margem do seu plano)<br />
                  <b>Total descontado do seu crédito: {formatCurrencyBRL(fee.total)}</b>
                </div>
              )}
              {fee.balance != null && (
                <div style={{ fontSize: 12, marginTop: 6, color: fee.sufficient ? 'var(--ok)' : 'var(--danger)' }}>
                  {fee.sufficient
                    ? `Seu saldo: ${formatCurrencyBRL(fee.balance)} — suficiente`
                    : `Saldo insuficiente (${formatCurrencyBRL(fee.balance)}). Compre créditos antes de criar.`}
                </div>
              )}
            </div>
          )}
          {fee && !fee.ok && lat && lng && (
            <div className="muted" style={{ fontSize: 12 }}>Não foi possível calcular a taxa: {fee.error}</div>
          )}

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

          {collectOnDelivery && (
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Valor a receber do cliente na entrega (R$)"
              value={orderValue}
              onChange={(e) => setOrderValue(e.target.value)}
            />
          )}

          <textarea className="input" placeholder="Observações de entrega" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

          {err && <div className="op-alert critical">{err}</div>}

          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !customerName.trim() || !address.trim() || (fee?.ok === true && fee.sufficient === false)}
          >
            {busy ? 'Criando…' : fee?.ok && fee.sufficient === false ? 'Saldo insuficiente' : 'Criar e buscar entregador'}
          </button>
        </div>
      </div>
    </div>
  );
}
