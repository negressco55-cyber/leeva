'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLeevaBrowserClient } from '@leeva/shared/client';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

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
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (e) {
      setErr(
        e instanceof Error
          ? 'O link expirou ou já foi usado — peça um novo em "Esqueci minha senha".'
          : 'erro',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1>Criar nova senha</h1>
      {ok ? (
        <p className="panel">Senha atualizada! Entrando…</p>
      ) : (
        <form onSubmit={submit} className="panel grid" style={{ marginTop: 16 }}>
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
          <button className="button" type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </div>
  );
}
