'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../../_lib/client';

export function CreditAdjust({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function apply(kind: 'bonus' | 'adjustment') {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) {
      setMsg('valor inválido');
      return;
    }
    const reason = window.prompt(`Motivo do ${kind === 'bonus' ? 'bônus' : 'ajuste'}:`) ?? '';
    if (!reason.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiPost(`/api/restaurants/${restaurantId}/credit`, { amount: v, kind, description: reason.trim() });
      setAmount('');
      setMsg('Crédito aplicado.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
      <input
        className="input"
        type="number"
        step="0.01"
        placeholder="R$"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: 110 }}
      />
      <button className="btn sm" disabled={busy} onClick={() => apply('bonus')}>+ Bônus</button>
      <button className="btn sm" disabled={busy} onClick={() => apply('adjustment')}>+ Ajuste</button>
      {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
    </div>
  );
}
