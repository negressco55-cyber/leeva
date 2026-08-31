'use client';

import { Suspense } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { login, type LoginState } from './actions';

const initial: LoginState = {};

function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);
  const redirectTo = useSearchParams().get('redirectTo') ?? '/dashboard';

  return (
    <form action={action} className="panel grid" style={{ marginTop: 16 }}>
      <input type="hidden" name="redirectTo" value={redirectTo} />
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
  );
}

export default function LoginPage() {
  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1>Leeva Restaurante</h1>
      <p className="muted">Acesse o painel de operação.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="muted" style={{ marginTop: 16 }}>
        Não tem conta? <Link href="/signup">Criar conta do restaurante</Link>
      </p>
    </div>
  );
}
