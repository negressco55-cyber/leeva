'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FLEET_MODE_LABELS,
  formatCurrencyBRL,
  type FleetMode,
  type LogisticsConfig,
  type PayoutConfig,
} from '@leeva/shared';
import { apiPost } from '../_lib/client';

type Plan = { code: string; name: string; monthly_price: number; per_delivery_price: number; features: unknown };

export default function ConfigForm({
  isOwner,
  initial,
  currentPlan,
  plans,
}: {
  isOwner: boolean;
  initial: { name: string; address: string; latitude: number | null; longitude: number | null; fleetMode: FleetMode; logistics: LogisticsConfig; payout: PayoutConfig };
  currentPlan: string;
  plans: Plan[];
}) {
  const router = useRouter();
  const [fleetMode, setFleetMode] = useState(initial.fleetMode);
  const [L, setL] = useState<LogisticsConfig>(initial.logistics);
  const [P, setP] = useState<PayoutConfig>(initial.payout);
  const [lat, setLat] = useState(initial.latitude != null ? String(initial.latitude) : '');
  const [lng, setLng] = useState(initial.longitude != null ? String(initial.longitude) : '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [pickupBusy, setPickupBusy] = useState(false);
  const [pickupMsg, setPickupMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ warnings?: string[]; ok?: boolean; err?: string } | null>(null);

  const nL = (k: keyof LogisticsConfig, v: number) => setL((s) => ({ ...s, [k]: v }));
  const nP = (k: keyof PayoutConfig, v: number) => setP((s) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiPost<{ ok: boolean; warnings: string[] }>('/api/config', {
        fleetMode,
        latitude: lat ? Number(lat) : undefined,
        longitude: lng ? Number(lng) : undefined,
        logistics: L,
        payout: P,
      });
      setMsg({ ok: true, warnings: r.warnings });
      router.refresh();
    } catch (e) {
      setMsg({ err: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function findPickup() {
    if (address.trim().length < 6) {
      setPickupMsg({ err: 'Digite o endereço completo: rua, número, bairro e cidade.' });
      return;
    }
    setPickupBusy(true);
    setPickupMsg(null);
    try {
      const r = await apiPost<{ latitude: number; longitude: number; label: string | null }>(
        '/api/config/pickup',
        { address: address.trim() },
      );
      setLat(String(r.latitude));
      setLng(String(r.longitude));
      setPickupMsg({ ok: r.label ? `Encontramos: ${r.label}` : 'Endereço localizado no mapa.' });
      router.refresh();
    } catch (e) {
      setPickupMsg({ err: (e as Error).message });
    } finally {
      setPickupBusy(false);
    }
  }

  async function switchPlan(code: string) {
    if (!confirm(`Mudar para o plano ${code}?`)) return;
    try {
      await apiPost('/api/billing', { planCode: code });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const num = (v: number, on: (n: number) => void, step = '0.5') => (
    <input className="input" type="number" step={step} value={v} onChange={(e) => on(Number(e.target.value))} />
  );

  return (
    <>
      <div className="page-head">
        <h1>Configurações</h1>
      </div>

      {!isOwner && <div className="op-alert warning">Apenas o dono do restaurante pode alterar estas configurações.</div>}

      <div className="card">
        <div className="card-title">Endereço do restaurante (ponto de coleta)</div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          É daqui que o sistema mede a distância de toda entrega. Precisa estar certo.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: '1 1 320px' }}
            placeholder="Rua, número, bairro, cidade"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!isOwner}
          />
          <button className="btn primary" type="button" onClick={findPickup} disabled={!isOwner || pickupBusy}>
            {pickupBusy ? 'Procurando…' : 'Encontrar no mapa'}
          </button>
        </div>
        {pickupMsg?.ok && <div className="op-alert ok" style={{ marginTop: 8 }}>{pickupMsg.ok}</div>}
        {pickupMsg?.err && <div className="op-alert critical" style={{ marginTop: 8 }}>{pickupMsg.err}</div>}

        <details style={{ marginTop: 10 }}>
          <summary className="muted" style={{ fontSize: 12, cursor: 'pointer' }}>Ajuste manual das coordenadas (avançado)</summary>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input className="input sm" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} disabled={!isOwner} />
            <input className="input sm" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} disabled={!isOwner} />
          </div>
          <p className="muted" style={{ fontSize: 11 }}>
            Salvo junto com o resto da configuração, no botão Salvar no fim da página.
          </p>
        </details>
      </div>

      <div className="card">
        <div className="card-title">Frota</div>
        {(Object.keys(FLEET_MODE_LABELS) as FleetMode[]).map((m) => (
          <label key={m} style={{ display: 'block', padding: '4px 0' }}>
            <input type="radio" checked={fleetMode === m} onChange={() => setFleetMode(m)} disabled={!isOwner} style={{ marginRight: 8 }} />
            {FLEET_MODE_LABELS[m]}
          </label>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Logística</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>Taxa de entrega cobrada (R$){num(L.customer_fee, (v) => nL('customer_fee', v))}</label>
          <label>Raio de atendimento (km){num(L.service_radius_km, (v) => nL('service_radius_km', v), '1')}</label>
          <label>Pedido mínimo (R$){num(L.min_order, (v) => nL('min_order', v))}</label>
          <label>Frete grátis acima de (R$, 0 = desligado){num(L.free_delivery_min_order ?? 0, (v) => setL((s) => ({ ...s, free_delivery_min_order: v || null })))}</label>
          <label>Tempo de oferta ao entregador (s){num(L.offer_timeout_seconds, (v) => nL('offer_timeout_seconds', v), '5')}</label>
          <label>Máx. tentativas de despacho{num(L.max_dispatch_attempts, (v) => nL('max_dispatch_attempts', v), '1')}</label>
        </div>
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          <label><input type="checkbox" checked={L.auto_dispatch_enabled} onChange={(e) => setL((s) => ({ ...s, auto_dispatch_enabled: e.target.checked }))} disabled={!isOwner} /> Despacho automático</label>
          <label><input type="checkbox" checked={L.grouping_enabled} onChange={(e) => setL((s) => ({ ...s, grouping_enabled: e.target.checked }))} disabled={!isOwner} /> Agrupamento de entregas</label>
          <label><input type="checkbox" checked={L.ifood_auto_call ?? true} onChange={(e) => setL((s) => ({ ...s, ifood_auto_call: e.target.checked }))} disabled={!isOwner} /> Chamar entregador automaticamente para pedidos do iFood</label>
          <span className="muted" style={{ fontSize: 12 }}>
            Desligado: cada pedido do iFood aparece no painel e no mapa como “aguardando você chamar”. Você
            escolhe quais enviar para o Leeva — os outros entrega como quiser, sem custo.
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Remuneração do entregador</div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Independente da taxa cobrada do cliente. O sistema avisa se gerar prejuízo.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <label>Valor base (R$){num(P.base, (v) => nP('base', v))}</label>
          <label>Mínimo por entrega (R$){num(P.min_payout, (v) => nP('min_payout', v))}</label>
          <label>Por km (R$){num(P.per_km, (v) => nP('per_km', v), '0.1')}</label>
          <label>Km grátis (não cobra){num(P.free_km, (v) => nP('free_km', v), '0.5')}</label>
          <label>Adicional por pedido agrupado (R$){num(P.grouped_extra, (v) => nP('grouped_extra', v))}</label>
          <label>Bônus de pico (R$){num(P.peak_bonus, (v) => nP('peak_bonus', v))}</label>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Simulação (3 km, entrega simples): <b>{formatCurrencyBRL(Math.max(P.min_payout, P.base + Math.max(0, 3 - P.free_km) * P.per_km))}</b>
        </p>
      </div>

      {msg?.warnings?.length ? (
        <div className="op-alert warning">
          <div>{msg.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}</div>
        </div>
      ) : null}
      {msg?.ok && !msg.warnings?.length && <div className="op-alert ok">Salvo.</div>}
      {msg?.err && <div className="op-alert critical">{msg.err}</div>}

      {isOwner && (
        <button className="btn primary" onClick={save} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar configurações'}
        </button>
      )}

      <div className="card" id="plano" style={{ marginTop: 20 }}>
        <div className="card-title">Plano</div>
        {plans.map((p) => (
          <div key={p.code} className="op-alert" style={{ background: p.code === currentPlan ? 'var(--accent-soft)' : 'transparent' }}>
            <div style={{ flex: 1 }}>
              <strong>{p.name}</strong> — {formatCurrencyBRL(p.monthly_price)}/mês + {formatCurrencyBRL(p.per_delivery_price)}/entrega
            </div>
            {p.code === currentPlan ? (
              <span className="tag green">atual</span>
            ) : isOwner ? (
              <button className="btn sm" onClick={() => switchPlan(p.code)}>Mudar</button>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
