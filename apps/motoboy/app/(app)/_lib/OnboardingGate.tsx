'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '../../login/actions';
import { DocumentsForm } from '../documentos/DocumentsForm';

type DocsStatus = {
  personalDocUrl: string | null;
  personalDocBackUrl: string | null;
  vehicleDocUrl: string | null;
  avatarUrl: string | null;
  cpf: string | null;
  city: string | null;
};

/** Bloqueia o app enquanto o cadastro não está aprovado + termos aceitos. */
export function OnboardingGate({
  state,
  reason,
  terms,
  docsStatus,
}: {
  state: 'pending_approval' | 'rejected' | 'terms';
  reason?: string | null;
  terms?: { version: number; content: string } | null;
  docsStatus?: DocsStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    if (!terms) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: terms.version }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'erro');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'erro');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'pending_approval') {
    return (
      <div className="screen">
        <div className="panel" style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>Quase lá!</h2>
          <p>
            Falta completar seus dados abaixo. Assim que enviar tudo, nossa equipe confere e libera seu acesso —
            geralmente em até um dia útil.
          </p>
          <div className="panel" style={{ padding: 12, marginTop: 12, borderColor: 'var(--brand)' }}>
            <div style={{ fontWeight: 700 }}>📲 Passo 1: baixe o app do Leeva</div>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
              Com o app (Android) você recebe as corridas com aviso e som, mesmo com a tela bloqueada. Use o mesmo
              e-mail e senha do cadastro.
            </p>
            <a className="button" href="https://leeva-apk.vercel.app" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>
              Baixar o app (Android)
            </a>
            <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>
              Ao abrir o arquivo, o Android pode pedir para permitir a instalação de fontes desconhecidas — toque em Permitir.
            </p>
          </div>
        </div>

        {docsStatus && (
          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>
              Passo 2: complete seus dados (pode ser aqui pelo site mesmo, ou dentro do app depois de baixar)
            </p>
            <DocumentsForm initial={docsStatus} showProgress />
          </div>
        )}

        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Assim que sua conta for aprovada, nossa equipe te avisa pelo WhatsApp.
        </p>

        <form action={logout} style={{ marginTop: 16 }}>
          <button className="button secondary" style={{ width: 'auto', padding: '8px 12px' }}>
            Sair
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="panel" style={{ marginTop: 24 }}>
        {state === 'rejected' && (
          <>
            <h2 style={{ marginTop: 0, color: 'var(--danger)' }}>Cadastro não aprovado</h2>
            <p>{reason || 'Seu cadastro não foi aprovado desta vez.'}</p>
            <p className="muted" style={{ fontSize: 13 }}>Fale com o suporte se tiver dúvidas.</p>
          </>
        )}

        {state === 'terms' && terms && (
          <>
            <h2 style={{ marginTop: 0 }}>Termos de uso (v{terms.version})</h2>
            <div
              style={{
                maxHeight: '45vh',
                overflowY: 'auto',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                margin: '10px 0',
              }}
            >
              {terms.content}
            </div>
            {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
            <button className="button" onClick={accept} disabled={busy}>
              {busy ? '…' : 'Li e aceito os termos'}
            </button>
          </>
        )}

        <form action={logout} style={{ marginTop: 16 }}>
          <button className="button secondary" style={{ width: 'auto', padding: '8px 12px' }}>
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
