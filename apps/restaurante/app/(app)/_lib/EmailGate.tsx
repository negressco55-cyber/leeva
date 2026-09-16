'use client';

import { useState } from 'react';
import { logout } from '../../login/actions';
import { resendVerificationEmail } from '../actions';

/** Bloqueia o painel até confirmar o e-mail do cadastro. */
export function EmailGate({ email }: { email: string | null }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setErr(null);
    try {
      const res = await resendVerificationEmail();
      if (!res.ok) throw new Error(res.error ?? 'erro');
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px' }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Confirme seu e-mail</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Falta confirmar o e-mail {email ? <b>{email}</b> : 'do seu cadastro'} pra usar o painel.
          Mandamos um link na hora do cadastro — se não achar, confira o spam ou peça outro abaixo.
        </p>
        {sent && <p style={{ color: 'var(--brand)' }}>Link reenviado — confira seu e-mail.</p>}
        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
        <button className="btn primary" onClick={resend} disabled={busy} style={{ marginTop: 8 }}>
          {busy ? '…' : 'Reenviar link de confirmação'}
        </button>
        <form action={logout} style={{ marginTop: 16 }}>
          <button className="btn sm">Sair</button>
        </form>
      </div>
    </div>
  );
}
