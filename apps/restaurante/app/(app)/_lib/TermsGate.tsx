'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '../../login/actions';

/** Bloqueia o painel do restaurante até aceitar a versão vigente dos termos. */
export function TermsGate({ terms }: { terms: { version: number; content: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: terms.version }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'erro');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Termos de uso (v{terms.version})</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Precisamos que você aceite os termos de uso pra continuar usando o painel.
        </p>
        <div
          style={{
            maxHeight: '45vh',
            overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            whiteSpace: 'pre-wrap',
            margin: '10px 0',
          }}
        >
          {terms.content}
        </div>
        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
        <button className="btn primary" onClick={accept} disabled={busy}>
          {busy ? '…' : 'Li e aceito os termos'}
        </button>
        <form action={logout} style={{ marginTop: 16 }}>
          <button className="btn sm">Sair</button>
        </form>
      </div>
    </div>
  );
}
