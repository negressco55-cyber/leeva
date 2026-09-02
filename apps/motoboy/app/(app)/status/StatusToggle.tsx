'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { type MotoboyStatus } from '@leeva/shared';

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
      <button
        type="button"
        className={`status-hero ${online ? 'on' : 'off'}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={online}
      >
        <span className="status-hero-ring">
          <ScooterIcon />
        </span>
        <span className="status-hero-state">{online ? 'Disponível' : 'Indisponível'}</span>
        <span className="status-hero-hint">
          {busy
            ? 'Um instante…'
            : online
              ? 'Você está recebendo ofertas. Toque para parar.'
              : 'Toque para começar a receber ofertas.'}
        </span>
      </button>

      {err && <p style={{ color: 'var(--danger)', margin: 0, textAlign: 'center' }}>{err}</p>}

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
          Ver entrega atual
        </Link>
      )}
    </div>
  );
}

function ScooterIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="17.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="17.5" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8.5 17.5h6.2l2.3-6.5H14M17 11l-1.2-4H13m-4.6 10.5c-.4-2.2-1.7-3.5-3.9-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
