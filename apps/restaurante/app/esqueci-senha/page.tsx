'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, type ForgotPasswordState } from '../login/actions';

const initial: ForgotPasswordState = {};

export default function EsqueciSenhaPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1>Esqueci minha senha</h1>
      <p className="muted">Digite seu e-mail — mandamos um link pra você criar uma senha nova.</p>

      {state.ok ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <p>Se esse e-mail tiver conta, chega um link em instantes. Confira a caixa de entrada (e o spam).</p>
          <Link href="/login">← Voltar pro login</Link>
        </div>
      ) : (
        <form action={action} className="panel grid" style={{ marginTop: 16 }}>
          <label>
            E-mail
            <input className="input" type="email" name="email" required />
          </label>
          {state.error && <p style={{ color: 'var(--danger)' }}>{state.error}</p>}
          <button className="button" type="submit" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar link'}
          </button>
          <Link href="/login" className="muted" style={{ fontSize: 13 }}>
            ← Voltar pro login
          </Link>
        </form>
      )}
    </div>
  );
}
