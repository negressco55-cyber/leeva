'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { activateMotoboy, type ActivateState } from './actions';

const initial: ActivateState = {};

export default function AtivarPage() {
  const [state, action, pending] = useActionState(activateMotoboy, initial);

  return (
    <div className="screen">
      <h1>Ativar conta</h1>
      <p className="muted">
        Use o mesmo telefone que o restaurante cadastrou. Você escolhe seu e-mail e senha
        agora.
      </p>

      <form action={action} className="panel grid" style={{ marginTop: 16 }}>
        <label>
          Telefone (com DDD)
          <input className="input" name="phone" inputMode="tel" required />
        </label>
        <label>
          E-mail
          <input className="input" type="email" name="email" required />
        </label>
        <label>
          Criar senha
          <input className="input" type="password" name="password" minLength={6} required />
        </label>

        {state.error && <p style={{ color: 'var(--danger)' }}>{state.error}</p>}

        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Ativando…' : 'Ativar e entrar'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16 }}>
        Já ativou? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
