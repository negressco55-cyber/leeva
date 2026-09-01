'use client';

import { useEffect, useState } from 'react';

type KeyRow = {
  id: string;
  name: string;
  last4: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function ApiKeys() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [fresh, setFresh] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/api-keys', { cache: 'no-store' });
    const d = await res.json().catch(() => ({ keys: [] }));
    if (res.ok) setKeys(d.keys ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    setErr(null);
    setFresh(null);
    try {
      const name = window.prompt('Nome da chave (ex: "Sistema do balcão"):') ?? 'Chave de API';
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'erro');
      setFresh({ key: d.key, name: d.name });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm('Revogar esta chave? Sistemas que a usam vão parar de funcionar.')) return;
    setBusy(true);
    try {
      await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2 style={{ fontSize: 15, marginTop: 0 }}>Chaves de API</h2>
      <p className="muted" style={{ fontSize: 13 }}>
        Use no header <code>x-leeva-api-key</code> para enviar entregas via{' '}
        <code>POST /api/v1/deliveries</code>. A chave completa aparece <b>uma única vez</b>.
      </p>

      {fresh && (
        <div className="op-alert ok" style={{ wordBreak: 'break-all' }}>
          <b>{fresh.name}</b> — copie agora, não será exibida de novo:
          <br />
          <code style={{ fontSize: 13 }}>{fresh.key}</code>
        </div>
      )}
      {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}

      <table className="data" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Final</th>
            <th>Criada</th>
            <th>Último uso</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id}>
              <td>{k.name}</td>
              <td>…{k.last4}</td>
              <td>{new Date(k.created_at).toLocaleDateString('pt-BR')}</td>
              <td>{k.last_used_at ? new Date(k.last_used_at).toLocaleString('pt-BR') : '—'}</td>
              <td>{k.revoked_at ? <span className="pill gray">revogada</span> : <span className="pill green">ativa</span>}</td>
              <td>
                {!k.revoked_at && (
                  <button className="button secondary" style={{ width: 'auto', padding: '4px 10px' }} disabled={busy} onClick={() => revoke(k.id)}>
                    Revogar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {keys.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">Nenhuma chave criada.</td>
            </tr>
          )}
        </tbody>
      </table>

      <button className="button" style={{ width: 'auto', marginTop: 10 }} disabled={busy} onClick={generate}>
        {busy ? '…' : '+ Gerar nova chave'}
      </button>
    </section>
  );
}
