'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { login, type LoginState } from './actions';

const initial: LoginState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <div className="screen">
      <h1>Leeva Motoboy</h1>
      <p className="muted">Entre para começar a receber entregas.</p>

      <form action={action} className="panel grid" style={{ marginTop: 16 }}>
        <label>
          E-mail
          <input className="input" type="email" name="email" required />
        </label>
        <label>
          Senha
          <input className="input" type="password" name="password" required />
        </label>

        {state.error && <p style={{ color: '#f87171' }}>{state.error}</p>}

        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16 }}>
        Primeiro acesso? <Link href="/ativar">Ativar minha conta</Link>
      </p>
    </div>
  );
}
