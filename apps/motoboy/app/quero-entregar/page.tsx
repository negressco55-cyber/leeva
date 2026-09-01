'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { submitSignup, type SignupState } from './actions';

const initial: SignupState = {};

export default function QueroEntregarPage() {
  const [state, action, pending] = useActionState(submitSignup, initial);

  return (
    <div className="screen">
      <h1>Quero entregar pelo Leeva</h1>
      <p className="muted">
        Cadastre-se para entrar na rede de entregadores. Seu cadastro passa por uma análise antes de você
        começar a receber ofertas.
      </p>

      <form action={action} className="panel grid" style={{ marginTop: 16, gap: 12 }} encType="multipart/form-data">
        <label>
          Nome completo
          <input className="input" name="fullName" required />
        </label>
        <label>
          E-mail
          <input className="input" type="email" name="email" required />
        </label>
        <label>
          Criar senha (mín. 6)
          <input className="input" type="password" name="password" required minLength={6} />
        </label>
        <label>
          Telefone (com DDD)
          <input className="input" name="phone" inputMode="tel" required />
        </label>
        <label>
          CPF
          <input className="input" name="cpf" inputMode="numeric" required />
        </label>
        <label>
          Cidade de atuação
          <input className="input" name="city" defaultValue="João Pessoa - PB" required />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1 }}>
            Chave Pix
            <input className="input" name="pixKey" required />
          </label>
          <label style={{ width: 130 }}>
            Tipo
            <select className="input" name="pixKeyType" defaultValue="cpf">
              <option value="cpf">CPF</option>
              <option value="phone">Celular</option>
              <option value="email">E-mail</option>
              <option value="random">Aleatória</option>
              <option value="cnpj">CNPJ</option>
            </select>
          </label>
        </div>

        <label>
          Documento pessoal (CNH ou RG) — foto ou PDF
          <input className="input" type="file" name="personalDoc" accept="image/*,application/pdf" required />
        </label>
        <label>
          Documento do veículo (CRLV) — foto ou PDF
          <input className="input" type="file" name="vehicleDoc" accept="image/*,application/pdf" required />
        </label>

        {state.error && <p style={{ color: '#f87171' }}>{state.error}</p>}

        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar cadastro'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16 }}>
        Já tem cadastro? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
