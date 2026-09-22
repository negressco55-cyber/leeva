'use client';

import { startTransition, useEffect, useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { submitSignup, type SignupState } from './actions';

const initial: SignupState = {};

const MAX_SIDE = 1600;
const MAX_TOTAL = 3.8 * 1024 * 1024; // a Vercel recusa envios acima de ~4,5 MB

/** Reduz a foto no celular antes de enviar (foto de câmera passa de 5 MB e
 *  estourava o limite de envio). PDF e formatos que o navegador não abre
 *  seguem como estão. */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size === 0) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Duas formas de anexar: tirar foto na hora (força a câmera) ou escolher
 *  um arquivo já existente — PDF ou foto da galeria. Separar os dois evita
 *  o problema comum de celular perder a foto tirada na hora num único
 *  input genérico. */
function DocInputs({ label, base, facing = 'environment' }: { label: string; base: string; facing?: 'user' | 'environment' }) {
  return (
    <div className="panel" style={{ padding: 12, display: 'grid', gap: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
      <label className="muted" style={{ fontSize: 12 }}>
        Tirar foto agora
        <input className="input" type="file" name={`${base}Photo`} accept="image/*" capture={facing} />
      </label>
      <label className="muted" style={{ fontSize: 12 }}>
        ou escolher arquivo (foto da galeria ou PDF)
        <input className="input" type="file" name={`${base}Pdf`} accept="image/*,application/pdf" />
      </label>
    </div>
  );
}

export default function QueroEntregarForm({
  terms,
}: {
  terms: { version: number; content: string } | null;
}) {
  const [state, action, pending] = useActionState(submitSignup, initial);
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  async function prepareAndSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setClientError(null);
    setPreparing(true);
    let total = 0;
    try {
      for (const [key, value] of Array.from(fd.entries())) {
        if (value instanceof File && value.size > 0) {
          const small = await shrinkImage(value);
          fd.set(key, small);
          total += small.size;
        }
      }
    } finally {
      setPreparing(false);
    }
    if (total > MAX_TOTAL) {
      setClientError(
        'Os arquivos estão grandes demais. Use "Tirar foto agora" em vez de PDF, ou envie PDFs menores (até 1 MB cada).',
      );
      return;
    }
    startTransition(() => {
      try {
        action(fd);
      } catch {
        setClientError('Não foi possível enviar. Confira sua internet e tente de novo — se estiver no navegador do WhatsApp, tente abrir o link no Chrome.');
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
        Cadastre-se para entrar na rede de entregadores. Seu cadastro passa por uma análise antes de você
        começar a receber ofertas.
      </p>

      <form onSubmit={prepareAndSubmit} className="panel grid" style={{ marginTop: 16, gap: 12 }} encType="multipart/form-data">
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
        <DocInputs label="Selfie — foto do seu rosto (sem óculos escuros ou capacete)" base="selfie" facing="user" />
        <p className="muted" style={{ fontSize: 11, margin: 0 }}>
          Se &quot;Tirar foto agora&quot; não funcionar no seu celular, use a opção &quot;escolher arquivo&quot; — ela também
          aceita PDF.
        </p>

        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          A chave Pix pra receber os repasses você cadastra depois, na aba Carteira.
        </p>

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

        <button className="button" type="submit" disabled={pending || preparing || (!!terms && !accepted)}>
          {preparing ? 'Preparando fotos…' : pending ? 'Enviando…' : 'Enviar cadastro'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16 }}>
        Já tem cadastro? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
