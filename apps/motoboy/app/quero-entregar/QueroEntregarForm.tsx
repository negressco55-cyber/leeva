'use client';

import { startTransition, useEffect, useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { submitSignup, type SignupState } from './actions';

const initial: SignupState = {};

/**
 * Cadastro RÁPIDO — nome, e-mail, telefone e senha. Sem CPF, sem documentos:
 * isso tudo é preenchido depois, um item de cada vez, no checklist "Meus
 * dados" (que aparece assim que a conta é criada). Um formulário pequeno
 * como esse é muito mais confiável numa internet ruim do que mandar 4 fotos
 * de uma vez só — era isso que quebrava antes.
 */
export default function QueroEntregarForm({
  terms,
}: {
  terms: { version: number; content: string } | null;
}) {
  const [state, action, pending] = useActionState(submitSignup, initial);
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  function prepareAndSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setClientError(null);
    startTransition(() => {
      try {
        action(fd);
      } catch {
        setClientError('Não foi possível enviar. Confira sua internet e tente de novo.');
      }
    });
  }

  // rede caiu / conexão instável durante o envio: mostra mensagem em vez de tela quebrada
  useEffect(() => {
    const onRejection = (ev: PromiseRejectionEvent) => {
      ev.preventDefault();
      setClientError('Não foi possível enviar. Confira sua internet e tente de novo — se estiver no navegador do WhatsApp, tente abrir o link no Chrome.');
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  return (
    <div className="screen">
      <h1>Quero entregar pelo Leeva</h1>
      <p className="muted">
        Cadastro rápido — leva 1 minuto. Seus documentos e CPF você envia logo depois, um de cada vez.
      </p>

      <form onSubmit={prepareAndSubmit} className="panel grid" style={{ marginTop: 16, gap: 12 }}>
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

        {terms && (
          <div className="panel" style={{ padding: 12, display: 'grid', gap: 8 }}>
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
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                required
              />
              Li e aceito os termos de uso
            </label>
          </div>
        )}

        {(clientError || state.error) && <p style={{ color: 'var(--danger)' }}>{clientError ?? state.error}</p>}

        <button className="button" type="submit" disabled={pending || (!!terms && !accepted)}>
          {pending ? 'Enviando…' : 'Criar minha conta'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16 }}>
        Já tem cadastro? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
