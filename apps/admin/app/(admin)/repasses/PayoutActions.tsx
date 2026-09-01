'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../_lib/client';

export function PayoutActions({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const act = (action: 'retry' | 'mark_paid') =>
    start(async () => {
      setErr(null);
      try {
        let note: string | undefined;
        if (action === 'mark_paid') {
          note = window.prompt('Nota (ex: transferência feita manualmente):') ?? '';
          if (!note.trim()) return;
        }
        await apiPost(`/api/payouts/${batchId}`, { action, note });
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'erro');
      }
    });

  return (
    <span style={{ display: 'flex', gap: 6 }}>
      <button className="btn sm" disabled={pending} onClick={() => act('retry')}>Reprocessar</button>
      <button className="btn sm" disabled={pending} onClick={() => act('mark_paid')}>Marcar pago</button>
      {err && <span className="muted" style={{ fontSize: 11 }}>{err}</span>}
    </span>
  );
}

export function CloseNow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            try {
              const r = await apiPost<{ paid: number; awaitingPix: number; failed: number; totalPaid: number }>('/api/payouts/close', {});
              setMsg(`Fechado: ${r.paid} pagos (${r.totalPaid?.toFixed?.(2) ?? r.totalPaid}), ${r.awaitingPix} sem Pix, ${r.failed} falhas.`);
              router.refresh();
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'erro');
            }
          })
        }
      >
        {pending ? 'Fechando…' : 'Fechar repasses agora'}
      </button>
      {msg && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{msg}</div>}
    </div>
  );
}
