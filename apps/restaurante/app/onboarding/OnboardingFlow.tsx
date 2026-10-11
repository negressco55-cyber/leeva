'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrencyBRL, type FleetMode } from '@leeva/shared';
import { defaultBusinessHours, type BusinessHours } from '@leeva/shared/services/business-hours';
import { apiGet, apiPost } from '../(app)/_lib/client';
import { BusinessHoursEditor } from '../(app)/_lib/BusinessHoursEditor';
import { Icon } from '../_icons/Icon';

type Plan = {
  code: string;
  name: string;
  monthly_price: number;
  per_delivery_margin: number;
  features: unknown;
  trial_days: number;
};

export default function OnboardingFlow({
  restaurantName,
  initial,
  plans,
}: {
  restaurantName: string;
  initial: {
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    fleetMode: FleetMode;
    logistics: Record<string, unknown>;
  };
  plans: Plan[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [lat, setLat] = useState(initial.latitude != null ? String(initial.latitude) : '');
  const [lng, setLng] = useState(initial.longitude != null ? String(initial.longitude) : '');
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [located, setLocated] = useState(initial.latitude != null && initial.longitude != null);
  // modelo atual: só frota própria + mensalidade (sem rede Leeva)
  const fleetMode: FleetMode = 'own';
  const [hours, setHours] = useState<BusinessHours>(defaultBusinessHours());
  const [expectedOrders, setExpectedOrders] = useState('');
  const [planCode, setPlanCode] = useState(plans[0]?.code ?? 'start');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function geocode() {
    setGeoMsg('buscando…');
    setLocated(false);
    try {
      const r = await apiGet<{ ok: boolean; latitude?: number; longitude?: number; label?: string }>(
        `/api/geocode?q=${encodeURIComponent(address)}`,
      );
      if (r.ok && r.latitude != null) {
        setLat(String(r.latitude));
        setLng(String(r.longitude));
        setGeoMsg(`✓ ${r.label ?? 'endereço localizado'}`);
        setLocated(true);
      } else {
        setGeoMsg('não encontrado — confira a rua, o número e o bairro');
      }
    } catch {
      setGeoMsg('serviço de mapas instável — tente de novo em instantes');
    }
  }

  async function finish() {
    setBusy(true);
    setErr(null);
    try {
      await apiPost('/api/onboarding', {
        name,
        address,
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
        fleetMode,
        businessHours: hours,
        expectedDailyOrders: expectedOrders ? Number(expectedOrders) : null,
        planCode,
      });
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>Bem-vindo ao Leeva</h1>
      <p className="muted">
        O Leeva cuida da <b>logística</b> das suas entregas. Seus pedidos continuam chegando pelos
        seus canais (WhatsApp, iFood, cardápio, telefone). Aqui você só acompanha e o sistema
        despacha automaticamente.
      </p>

      <div className="seg" style={{ margin: '16px 0' }}>
        {[1, 2, 3, 4].map((s) => (
          <span key={s} style={{ padding: '6px 12px', color: s === step ? 'var(--accent)' : 'var(--muted)' }}>
            {s}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="card-title">Dados do restaurante</div>
          <input className="input" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input"
            placeholder="Endereço (ponto de coleta) — rua, número, bairro"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setLocated(false);
              setGeoMsg(null);
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn sm" onClick={geocode} disabled={address.trim().length < 5}><Icon name="pin" size={13} /> Localizar</button>
            {geoMsg && (
              <span style={{ fontSize: 12, color: located ? 'var(--ok)' : 'var(--muted)' }}>{geoMsg}</span>
            )}
          </div>
          <button
            className="btn primary"
            onClick={() => setStep(2)}
            disabled={!name.trim() || !address.trim() || !located}
          >
            {located ? 'Continuar' : 'Localize o endereço primeiro'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="card-title">Seus motoboys, organizados</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
            Você usa os <b>seus próprios entregadores</b> e paga eles direto, como já faz hoje. O Leeva monta as
            rotas, manda as entregas pro app deles e mostra todo mundo no mapa ao vivo. Depois de entrar, cadastre a
            equipe em <b>Motoboys</b> e mande o convite pelo WhatsApp.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setStep(1)}>Voltar</button>
            <button className="btn primary" onClick={() => setStep(3)}>Continuar</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="card-title">Horário de funcionamento</div>
          <BusinessHoursEditor value={hours} onChange={setHours} />
          <label style={{ marginTop: 4 }}>
            Quantos pedidos por dia você espera fazer, aproximadamente? (opcional)
            <input
              className="input"
              type="number"
              min={0}
              placeholder="ex: 20"
              value={expectedOrders}
              onChange={(e) => setExpectedOrders(e.target.value)}
            />
          </label>
          <div className="muted" style={{ fontSize: 12 }}>
            Só pra gente se preparar — não trava nada e não aparece de volta pra você depois.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setStep(2)}>Voltar</button>
            <button className="btn primary" onClick={() => setStep(4)}>Continuar</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="card-title">Escolha o plano</div>
          {plans.map((p) => (
            <label key={p.code} className="op-alert" style={{ cursor: 'pointer', background: planCode === p.code ? 'var(--accent-soft)' : 'transparent' }}>
              <input type="radio" checked={planCode === p.code} onChange={() => setPlanCode(p.code)} style={{ marginRight: 8 }} />
              <div style={{ flex: 1 }}>
                <strong>{p.name}</strong> — {formatCurrencyBRL(p.monthly_price)}/mês, sem taxa por entrega
                <div className="muted" style={{ fontSize: 12 }}>
                  {p.trial_days} dias grátis · {(p.features as { leeva_network?: boolean }).leeva_network ? 'rede Leeva' : 'frota própria'}
                  {(p.features as { heatmap?: boolean }).heatmap ? ' · heatmap' : ''}
                  {(p.features as { finance?: boolean }).finance ? ' · financeiro' : ''}
                </div>
              </div>
            </label>
          ))}
          {err && <div className="op-alert critical">{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setStep(3)}>Voltar</button>
            <button className="btn primary" onClick={finish} disabled={busy}>
              {busy ? 'Configurando…' : 'Começar a operar'}
            </button>
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>{restaurantName}</p>
    </div>
  );
}
