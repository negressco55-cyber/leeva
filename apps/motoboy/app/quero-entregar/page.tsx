'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { submitSignup, type SignupState } from './actions';

const initial: SignupState = {};

/** Duas formas de anexar: tirar foto na hora (força a câmera) ou escolher
 *  um arquivo já existente — PDF ou foto da galeria. Separar os dois evita
 *  o problema comum de celular perder a foto tirada na hora num único
 *  input genérico. */
function DocInputs({ label, base }: { label: string; base: string }) {
  return (
    <div className="panel" style={{ padding: 12, display: 'grid', gap: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
      <label className="muted" style={{ fontSize: 12 }}>
        Tirar foto agora
        <input className="input" type="file" name={`${base}Photo`} accept="image/*" capture="environment" />
      </label>
      <label className="muted" style={{ fontSize: 12 }}>
        ou escolher arquivo (foto da galeria ou PDF)
        <input className="input" type="file" name={`${base}Pdf`} accept="image/*,application/pdf" />
      </label>
    </div>
  );
}

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

        <DocInputs label="Documento pessoal (CNH ou RG) — frente" base="personalDocFront" />
        <DocInputs label="Documento pessoal (CNH ou RG) — verso" base="personalDocBack" />
        <DocInputs label="Documento do veículo (CRLV)" base="vehicleDoc" />
        <p className="muted" style={{ fontSize: 11, margin: 0 }}>
          Se &quot;Tirar foto agora&quot; não funcionar no seu celular, use a opção &quot;escolher arquivo&quot; — ela também
          aceita PDF.
        </p>

        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          A chave Pix pra receber os repasses você cadastra depois, na aba Carteira.
        </p>

        {state.error && <p style={{ color: 'var(--danger)' }}>{state.error}</p>}

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
