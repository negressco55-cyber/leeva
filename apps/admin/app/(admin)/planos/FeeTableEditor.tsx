'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../_lib/client';

type Cfg = {
  base: number;
  per_km: number;
  free_km: number;
  min_payout: number;
  group_stop_min: number;
  group_radius_km: number;
  group_max_stops: number;
};

export function FeeTableEditor({ initial }: { initial: Cfg }) {
  const router = useRouter();
  const [c, setC] = useState<Cfg>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const n = (v: string) => (v === '' ? 0 : Number(v));

  // simulação: 3 km
  const sim = (km: number) => {
    const extra = Math.max(0, km - c.free_km) * c.per_km;
    return Math.max(c.min_payout, c.base + extra);
  };

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await apiPost('/api/fee-config', c);
      setMsg('Tabela salva. Vale para as próximas entregas criadas.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'erro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Tabela de valores do entregador</div>
      <p className="muted" style={{ fontSize: 12 }}>
        Valor que o entregador recebe por entrega (100% dele). Distância = linha reta × 1,3 (fator de rua).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label>Base (R$) — cobre os primeiros {c.free_km} km
          <input className="input" type="number" step="0.01" value={c.base} onChange={(e) => setC({ ...c, base: n(e.target.value) })} />
        </label>
        <label>Km grátis (não cobra)
          <input className="input" type="number" step="0.1" value={c.free_km} onChange={(e) => setC({ ...c, free_km: n(e.target.value) })} />
        </label>
        <label>Por km adicional (R$)
          <input className="input" type="number" step="0.01" value={c.per_km} onChange={(e) => setC({ ...c, per_km: n(e.target.value) })} />
        </label>
        <label>Mínimo garantido (R$)
          <input className="input" type="number" step="0.01" value={c.min_payout} onChange={(e) => setC({ ...c, min_payout: n(e.target.value) })} />
        </label>
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
        Simulação: 2 km → <b>R$ {sim(2).toFixed(2)}</b> · 3 km → <b>R$ {sim(3).toFixed(2)}</b> · 5 km → <b>R$ {sim(5).toFixed(2)}</b>
      </div>

      <div className="card-title" style={{ marginTop: 18 }}>Agrupamento de entregas</div>
      <p className="muted" style={{ fontSize: 12 }}>
        Quando 2+ pedidos do mesmo restaurante têm destinos próximos, o despacho oferece uma rota única.
        A 1ª parada paga a tabela cheia; cada parada extra paga a distância entre uma parada e a
        seguinte (× valor por km), com um piso garantido.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label>Piso por parada extra (R$)
          <input className="input" type="number" step="0.01" value={c.group_stop_min} onChange={(e) => setC({ ...c, group_stop_min: n(e.target.value) })} />
        </label>
        <label>Raio p/ agrupar (km)
          <input className="input" type="number" step="0.1" value={c.group_radius_km} onChange={(e) => setC({ ...c, group_radius_km: n(e.target.value) })} />
        </label>
        <label>Paradas por rota (máx.) — 1 desliga
          <input className="input" type="number" step="1" value={c.group_max_stops} onChange={(e) => setC({ ...c, group_max_stops: n(e.target.value) })} />
        </label>
      </div>
      {msg && <div className="op-alert ok" style={{ marginTop: 8 }}>{msg}</div>}
      <button className="btn" onClick={save} disabled={saving} style={{ marginTop: 10 }}>
        {saving ? 'Salvando…' : 'Salvar tabela'}
      </button>
    </div>
  );
}
