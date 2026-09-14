'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TYPES: { v: string; label: string }[] = [
  { v: 'cpf', label: 'CPF' },
  { v: 'phone', label: 'Celular' },
  { v: 'email', label: 'E-mail' },
  { v: 'random', label: 'Aleatória' },
  { v: 'cnpj', label: 'CNPJ' },
];

export function PixForm({ initial }: { initial: { masked: string | null; type: string | null } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!initial.masked);
  const [key, setKey] = useState('');
  const [type, setType] = useState(initial.type ?? 'cpf');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/pix', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), type }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'erro');
      setMsg('Chave Pix salva. Seus repasses vão para essa chave.');
      setEditing(false);
      setKey('');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2 style={{ fontSize: 15, marginTop: 0 }}>Sua chave Pix</h2>
      {!editing && initial.masked ? (
        <>
          <div style={{ fontSize: 16 }}>
            {initial.masked} <span className="muted">({TYPES.find((t) => t.v === initial.type)?.label ?? initial.type})</span>
          </div>
          <button className="button secondary" style={{ marginTop: 8 }} onClick={() => setEditing(true)}>
            Trocar chave
          </button>
        </>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          <div className="segmented">
            {TYPES.map((t) => (
              <button
                key={t.v}
                type="button"
                className={type === t.v ? 'active' : ''}
                onClick={() => setType(t.v)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Sua chave Pix" value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="button" onClick={save} disabled={busy || key.trim().length < 5}>
            {busy ? 'Salvando…' : 'Salvar chave Pix'}
          </button>
        </div>
      )}
      {msg && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{msg}</p>}
      {!initial.masked && (
        <p style={{ fontSize: 13, color: 'var(--warn)', marginTop: 8 }}>
          ⚠️ Cadastre sua chave Pix para receber os repasses das entregas.
        </p>
      )}
    </div>
  );
}
