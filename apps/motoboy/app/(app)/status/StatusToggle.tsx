'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MOTOBOY_STATUS_LABELS, type MotoboyStatus } from '@leeva/shared';

export default function StatusToggle({
  initialStatus,
  activeDeliveries,
  doneToday,
}: {
  restaurantId: string | null;
  motoboyId: string;
  initialStatus: MotoboyStatus;
  activeDeliveries: number;
  doneToday: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<MotoboyStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const online = status !== 'offline';

  async function toggle() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ online: !online }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus(data.status);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="panel" style={{ textAlign: 'center' }}>
        <p className="muted">Você está</p>
        <div style={{ fontSize: 28, fontWeight: 800, color: online ? 'var(--ok)' : 'var(--muted)' }}>
          {MOTOBOY_STATUS_LABELS[status]}
        </div>
        <button
          className="button"
          onClick={toggle}
          disabled={busy}
          style={{ marginTop: 16, background: online ? '#45191b' : 'var(--ok)' }}
        >
          {busy ? '…' : online ? 'Ficar offline' : 'Ficar online'}
        </button>
        {err && <p style={{ color: '#f87171', marginTop: 8 }}>{err}</p>}
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="panel" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{activeDeliveries}</div>
          <div className="muted" style={{ fontSize: 13 }}>entregas ativas</div>
        </div>
        <div className="panel" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{doneToday}</div>
          <div className="muted" style={{ fontSize: 13 }}>concluídas hoje</div>
        </div>
      </div>

      {activeDeliveries > 0 && (
        <Link href="/entrega" className="button" style={{ textAlign: 'center' }}>
          Ver entrega atual →
        </Link>
      )}
    </div>
  );
}
