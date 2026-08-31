'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signupRestaurant, type SignupState } from './actions';

const initial: SignupState = {};

export default function SignupPage() {
  const [state, action, pending] = useActionState(signupRestaurant, initial);

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1>Criar conta do restaurante</h1>
      <p className="muted">Isso cria o restaurante e o primeiro usuário (dono).</p>

      <form action={action} className="panel grid" style={{ marginTop: 16 }}>
        <label>
          Nome do restaurante
          <input className="input" name="restaurantName" required />
        </label>
        <label>
          Seu nome
          <input className="input" name="fullName" required />
        </label>
        <label>
          E-mail
          <input className="input" type="email" name="email" required />
        </label>
        <label>
          Senha
          <input className="input" type="password" name="password" minLength={6} required />
        </label>

        {state.error && <p style={{ color: '#f87171' }}>{state.error}</p>}

        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Criando…' : 'Criar conta'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16 }}>
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
