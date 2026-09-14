'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../_lib/client';

type Cfg = {
  per_km: number;
  per_km_grouped: number;
  min_payout: number;
  group_radius_km: number;
  group_max_stops: number;
};

export function FeeTableEditor({ initial }: { initial: Cfg }) {
  const router = useRouter();
  const [c, setC] = useState<Cfg>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const n = (v: string) => (v === '' ? 0 : Number(v));

  // simulação: entrega solta
  const sim = (km: number) => Math.max(c.min_payout, km * c.per_km);
  // simulação: parada extra de rota agrupada (trecho incremental)
  const simGrouped = (km: number) => Math.max(c.min_payout, km * c.per_km_grouped);

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
        Fórmula: valor por km × distância, nunca abaixo do mínimo garantido.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label>Por km — entrega solta (R$)
          <input className="input" type="number" step="0.01" value={c.per_km} onChange={(e) => setC({ ...c, per_km: n(e.target.value) })} />
        </label>
        <label>Mínimo garantido (R$)
          <input className="input" type="number" step="0.01" value={c.min_payout} onChange={(e) => setC({ ...c, min_payout: n(e.target.value) })} />
        </label>
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
        Simulação (entrega solta): 2 km → <b>R$ {sim(2).toFixed(2)}</b> · 3 km → <b>R$ {sim(3).toFixed(2)}</b> · 4 km → <b>R$ {sim(4).toFixed(2)}</b> · 5 km → <b>R$ {sim(5).toFixed(2)}</b>
      </div>

      <div className="card-title" style={{ marginTop: 18 }}>Agrupamento de entregas</div>
      <p className="muted" style={{ fontSize: 12 }}>
        Quando 2+ pedidos do mesmo restaurante têm destinos próximos, o despacho oferece uma rota única.
        A 1ª parada (líder) paga a tabela de entrega solta acima, do restaurante até ela; cada parada
        extra paga o trecho incremental (da parada anterior até essa) por um valor de km próprio — mais
        alto que o da entrega solta, para compensar o motoboy por aceitar agrupar — com o mesmo mínimo
        garantido.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label>Por km — parada extra de rota (R$)
          <input className="input" type="number" step="0.01" value={c.per_km_grouped} onChange={(e) => setC({ ...c, per_km_grouped: n(e.target.value) })} />
        </label>
        <label>Raio p/ agrupar (km)
          <input className="input" type="number" step="0.1" value={c.group_radius_km} onChange={(e) => setC({ ...c, group_radius_km: n(e.target.value) })} />
        </label>
        <label>Paradas por rota (máx.) — 1 desliga
          <input className="input" type="number" step="1" value={c.group_max_stops} onChange={(e) => setC({ ...c, group_max_stops: n(e.target.value) })} />
        </label>
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
        Simulação (parada extra, trecho incremental): 2 km → <b>R$ {simGrouped(2).toFixed(2)}</b> · 3 km → <b>R$ {simGrouped(3).toFixed(2)}</b>
      </div>
      {msg && <div className="op-alert ok" style={{ marginTop: 8 }}>{msg}</div>}
      <button className="btn" onClick={save} disabled={saving} style={{ marginTop: 10 }}>
        {saving ? 'Salvando…' : 'Salvar tabela'}
      </button>
    </div>
  );
}
