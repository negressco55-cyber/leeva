'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrencyBRL } from '@leeva/shared';

type Result =
  | { ok: true; amount: number; fee: number; netAmount: number; simulated: boolean }
  | { ok: false; error: string; code?: string };

export function RequestPayoutButton({ disabled, disabledReason }: { disabled: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null);

  async function request() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/payouts/request', { method: 'POST' });
      const data = (await res.json()) as Result;
      if (!data.ok) throw new Error(data.error);
      setMsg({
        ok: `Repasse de ${formatCurrencyBRL(data.netAmount)} enviado para sua chave Pix${data.fee > 0 ? ` (taxa de ${formatCurrencyBRL(data.fee)} descontada)` : ''}.`,
      });
      router.refresh();
    } catch (e) {
      setMsg({ err: e instanceof Error ? e.message : 'Não foi possível solicitar. Tente de novo.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button className="button" onClick={request} disabled={disabled || busy}>
        {busy ? 'Solicitando…' : 'Solicitar repasse'}
      </button>
      {disabled && disabledReason && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{disabledReason}</p>}
      {msg?.ok && <div className="op-alert ok" style={{ marginTop: 8 }}>{msg.ok}</div>}
      {msg?.err && <div className="op-alert critical" style={{ marginTop: 8 }}>{msg.err}</div>}
    </div>
  );
}
