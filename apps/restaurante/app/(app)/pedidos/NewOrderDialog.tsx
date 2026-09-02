'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, ApiError } from '../_lib/client';
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

type GeoStatus = 'idle' | 'ok' | 'not_found' | 'unavailable';

/**
 * Nova entrega — o restaurante informa o endereço, que é localizado no mapa
 * ANTES de criar. Endereço que não é encontrado não gera pedido. O Leeva
 * calcula a taxa pela distância e mostra antes de confirmar.
 */
export default function NewOrderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geocoding, setGeocoding] = useState(false);
  const [confirmManual, setConfirmManual] = useState(false);
  const [orderValue, setOrderValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fee, setFee] = useState<FeePreview | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const collectOnDelivery = paymentPendingOnDelivery(paymentMethod, paymentStatus);

  // endereço localizado (geocodificado) OU instabilidade + confirmação manual
  const located = geoStatus === 'ok';
  const manualOk = geoStatus === 'unavailable' && confirmManual && !!lat && !!lng;
  const addressReady = located || manualOk;

  // qualquer edição do endereço invalida a localização anterior
  useEffect(() => {
    setGeoStatus('idle');
    setGeoLabel(null);
    setConfirmManual(false);
  }, [address]);

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
        setGeoLabel(r.label ?? 'Endereço localizado');
        setGeoStatus('ok');
      } else {
        setGeoStatus('not_found');
        setGeoLabel(null);
      }
    } catch {
      // falha de rede/serviço — instabilidade, não "endereço errado"
      setGeoStatus('unavailable');
      setGeoLabel(null);
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
        addressConfirmed: manualOk,
        total: collectOnDelivery && orderValue ? Number(orderValue) : 0,
        paymentMethod,
        paymentStatus,
        notes: notes || null,
        items: [],
      });
      onCreated();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'geocoder_unavailable') {
        setGeoStatus('unavailable');
        setErr('O serviço de mapas está instável. Confira o endereço e marque a confirmação abaixo para prosseguir.');
      } else if (e instanceof ApiError && e.code === 'address_not_found') {
        setGeoStatus('not_found');
        setErr('Não conseguimos localizar esse endereço. Revise a rua, o número e o bairro.');
      } else {
        setErr((e as Error).message);
      }
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
          O Leeva localiza o endereço, calcula a taxa pela distância e encontra o entregador automaticamente.
        </p>

        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          <input className="input" placeholder="Nome do cliente *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className="input" placeholder="Telefone (WhatsApp) — para o rastreamento" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          <input className="input" placeholder="Endereço de entrega * (rua, número, bairro)" value={address} onChange={(e) => setAddress(e.target.value)} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={geocode} disabled={geocoding || address.trim().length < 5}>
              {geocoding ? 'Localizando…' : '📍 Localizar no mapa'}
            </button>
            {located && (
              <span style={{ fontSize: 12, color: 'var(--ok)' }}>✓ {geoLabel}</span>
            )}
          </div>

          {geoStatus === 'not_found' && (
            <div className="op-alert critical" style={{ marginBottom: 0 }}>
              Não conseguimos localizar esse endereço. Confira a rua, o número e o bairro e tente de novo.
            </div>
          )}

          {geoStatus === 'unavailable' && (
            <div className="op-alert warning" style={{ marginBottom: 0 }}>
              <div>O serviço de mapas está instável agora.</div>
              <div style={{ marginTop: 6 }}>
                Você pode informar a localização manualmente (latitude/longitude) e confirmar:
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input className="input" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} style={{ flex: 1 }} />
                <input className="input" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} style={{ flex: 1 }} />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 13 }}>
                <input type="checkbox" checked={confirmManual} onChange={(e) => setConfirmManual(e.target.checked)} />
                Confirmo que este endereço e esta localização estão corretos.
              </label>
            </div>
          )}

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

          {!addressReady && address.trim().length >= 5 && geoStatus === 'idle' && (
            <div className="muted" style={{ fontSize: 12 }}>
              Clique em “Localizar no mapa” para confirmar o endereço antes de criar.
            </div>
          )}

          <button
            className="btn primary"
            onClick={submit}
            disabled={
              busy ||
              !customerName.trim() ||
              !address.trim() ||
              !addressReady ||
              (fee?.ok === true && fee.sufficient === false)
            }
          >
            {busy
              ? 'Criando…'
              : fee?.ok && fee.sufficient === false
                ? 'Saldo insuficiente'
                : !addressReady
                  ? 'Localize o endereço primeiro'
                  : 'Criar e buscar entregador'}
          </button>
        </div>
      </div>
    </div>
  );
}
