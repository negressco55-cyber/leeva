'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const initial: LoginState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, initial);
  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1>Leeva Admin</h1>
      <p className="muted">Painel da plataforma. Acesso restrito ao operador.</p>
      <form action={action} className="card grid" style={{ marginTop: 16, gap: 12, display: 'grid' }}>
        <label>
          E-mail
          <input className="input" type="email" name="email" required />
        </label>
        <label>
          Senha
          <input className="input" type="password" name="password" required />
        </label>
        {state.error && <p style={{ color: 'var(--danger)' }}>{state.error}</p>}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
