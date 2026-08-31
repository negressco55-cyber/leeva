'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../_lib/client';

type Cfg = {
  weights: Record<string, number>;
  acceptance_soft_impact: number;
  incident_penalty: Record<string, number>;
  incident_window_days: number;
  sla_minutes: number;
  block_threshold: number;
  min_sample: number;
};

export function ReputationEditor({ initial }: { initial: Cfg }) {
  const router = useRouter();
  const [c, setC] = useState<Cfg>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const num = (v: string) => (v === '' ? 0 : Number(v));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await apiPost('/api/reputation-config', c);
      setMsg('Configuração salva. Vale a partir do próximo recálculo (cron ~1 min).');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'erro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {msg && <div className="op-alert ok" style={{ marginBottom: 12 }}>{msg}</div>}
      <div className="card">
        <div className="card-title">Pesos dos componentes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          {Object.keys(c.weights).map((k) => (
            <label key={k}>
              {k}
              <input
                className="input"
                type="number"
                value={c.weights[k]}
                onChange={(e) => setC({ ...c, weights: { ...c.weights, [k]: num(e.target.value) } })}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Penalidade por incidente (origem = entregador)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          {Object.keys(c.incident_penalty).map((k) => (
            <label key={k}>
              {k}
              <input
                className="input"
                type="number"
                value={c.incident_penalty[k]}
                onChange={(e) => setC({ ...c, incident_penalty: { ...c.incident_penalty, [k]: num(e.target.value) } })}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Limiares</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          <label>Impacto suave da recusa (0–1)
            <input className="input" type="number" step="0.1" value={c.acceptance_soft_impact} onChange={(e) => setC({ ...c, acceptance_soft_impact: num(e.target.value) })} />
          </label>
          <label>Janela de incidentes (dias)
            <input className="input" type="number" value={c.incident_window_days} onChange={(e) => setC({ ...c, incident_window_days: num(e.target.value) })} />
          </label>
          <label>SLA (minutos)
            <input className="input" type="number" value={c.sla_minutes} onChange={(e) => setC({ ...c, sla_minutes: num(e.target.value) })} />
          </label>
          <label>Limiar de bloqueio (índice)
            <input className="input" type="number" value={c.block_threshold} onChange={(e) => setC({ ...c, block_threshold: num(e.target.value) })} />
          </label>
          <label>Amostra mínima
            <input className="input" type="number" value={c.min_sample} onChange={(e) => setC({ ...c, min_sample: num(e.target.value) })} />
          </label>
        </div>
      </div>

      <button className="btn" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar configuração'}</button>
    </>
  );
}
