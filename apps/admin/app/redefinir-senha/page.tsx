'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLeevaBrowserClient } from '@leeva/shared/client';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // o link de recuperação estabelece a sessão no navegador de forma
  // assíncrona (o Supabase processa o link ao carregar a página) — espera
  // o evento antes de liberar o formulário, senão dá "sessão inválida".
  useEffect(() => {
    const supabase = createLeevaBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const t = setTimeout(() => {
      setReady((r) => {
        if (!r) setLinkInvalid(true);
        return r;
      });
    }, 4000);
    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setErr('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const supabase = createLeevaBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setOk(true);
      setTimeout(() => router.push('/visao-geral'), 1200);
    } catch {
      setErr('O link expirou ou já foi usado — peça um novo em "Esqueci minha senha".');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1>Criar nova senha</h1>
      {ok ? (
        <p className="card">Senha atualizada! Entrando…</p>
      ) : linkInvalid ? (
        <div className="card">
          <p>Esse link expirou ou já foi usado.</p>
          <a href="/esqueci-senha">Pedir um link novo</a>
        </div>
      ) : !ready ? (
        <p className="muted" style={{ marginTop: 16 }}>Conferindo o link…</p>
      ) : (
        <form onSubmit={submit} className="card grid" style={{ marginTop: 16, gap: 12, display: 'grid' }}>
          <label>
            Nova senha (mín. 6 caracteres)
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </div>
  );
}
