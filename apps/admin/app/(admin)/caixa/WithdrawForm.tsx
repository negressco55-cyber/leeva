'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function WithdrawForm({ available }: { available: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const n = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(n) && n > 0;
  const overAvailable = valid && n > available;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/caixa/saque', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: n, description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'erro');
      setMsg('Registrado. Lembre de fazer a transferência de verdade no painel da Asaas, se ainda não fez.');
      setAmount('');
      setDescription('');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12, maxWidth: 420 }}>
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="Valor sacado (R$)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn" onClick={submit} disabled={!valid || busy}>
          {busy ? 'Registrando…' : 'Registrar saque'}
        </button>
      </div>
      <input
        className="input"
        placeholder="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ marginTop: 8, width: '100%' }}
      />
      {overAvailable && (
        <p style={{ color: '#d97706', fontSize: 12, marginTop: 6 }}>
          ⚠️ Esse valor é maior que o disponível ({available.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) — provavelmente mexe no dinheiro de restaurante ou motoboy.
        </p>
      )}
      <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
        Isto só registra no controle — a transferência real é feita por você, direto no painel da Asaas.
      </p>
      {msg && <div className="op-alert ok" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
