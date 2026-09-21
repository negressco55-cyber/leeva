'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { signupRestaurant, type SignupState } from './actions';

const initial: SignupState = {};

export default function SignupForm({ terms }: { terms: { version: number; content: string } | null }) {
  const [state, action, pending] = useActionState(signupRestaurant, initial);
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);

  if (state.ok) {
    return (
      <div className="container" style={{ maxWidth: 420 }}>
        <h1>Confira seu e-mail</h1>
        <p className="muted">
          Mandamos um link de confirmação. Clique nele pra ativar sua conta e entrar no painel.
        </p>
        <p className="muted" style={{ marginTop: 16 }}>
          <Link href="/login">Voltar pro login</Link>
        </p>
      </div>
    );
  }

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
          WhatsApp do restaurante
          <input className="input" name="whatsapp" placeholder="(83) 99999-9999" />
        </label>
        <label>
          E-mail
          <input className="input" type="email" name="email" required />
        </label>
        <label>
          Senha
          <input className="input" type="password" name="password" minLength={6} required />
        </label>

        {terms && (
          <div style={{ display: 'grid', gap: 8 }}>
            <input type="hidden" name="termsVersion" value={terms.version} />
            <button
              type="button"
              className="muted"
              style={{ fontSize: 13, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setShowTerms((v) => !v)}
            >
              {showTerms ? 'Esconder termos de uso' : 'Ler os termos de uso'}
            </button>
            {showTerms && (
              <div
                style={{
                  maxHeight: '40vh',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {terms.content}
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
              Li e aceito os termos de uso
            </label>
          </div>
        )}

        {state.error && <p style={{ color: 'var(--danger)' }}>{state.error}</p>}

        <button className="button" type="submit" disabled={pending || (!!terms && !accepted)}>
          {pending ? 'Criando…' : 'Criar conta'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16 }}>
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
