'use client';

import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

/** Primeiro item do checklist "Meus dados" — CPF e cidade, pedidos separado
 *  dos documentos pra manter o cadastro inicial rápido (só nome/e-mail/senha). */
export function PersonalDataCard({
  initialCpf,
  initialCity,
  onSaved,
}: {
  initialCpf: string | null;
  initialCity: string | null;
  onSaved: (cpf: string, city: string) => void;
}) {
  const done = !!initialCpf && !!initialCity;
  const [editing, setEditing] = useState(!done);
  const [cpf, setCpf] = useState(initialCpf ?? '');
  const [city, setCity] = useState(initialCity ?? 'João Pessoa - PB');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/personal-data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cpf, city }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'erro ao salvar');
      onSaved(cpf, city);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 15 }}>Dados pessoais</strong>
        <span className={`badge ${done ? 'ok' : ''}`} style={!done ? { background: 'var(--surface-2)', color: 'var(--muted)' } : undefined}>
          {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
          {done ? 'Enviado' : 'Pendente'}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>Seu CPF e a cidade onde você entrega.</p>

      {!editing && done ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>{cpf} — {city}</span>
          <button type="button" className="button secondary" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => setEditing(true)}>
            Editar
          </button>
        </div>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          <input
            className="input"
            inputMode="numeric"
            placeholder="CPF (só números)"
            value={cpf}
            onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
          />
          <input className="input" placeholder="Cidade onde você entrega" value={city} onChange={(e) => setCity(e.target.value)} />
          {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{err}</p>}
          <button type="button" className="button" disabled={busy || cpf.length !== 11 || city.trim().length < 2} onClick={save}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      )}
    </div>
  );
}
