'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrencyBRL, type MotoboyStatus } from '@leeva/shared';
import LiveMap from '../_lib/LiveMap';
import Avatar from '../_lib/Avatar';

export default function StatusToggle({
  fullName,
  initialStatus,
  activeDeliveries,
  doneToday,
  earnedToday,
}: {
  restaurantId: string | null;
  motoboyId: string;
  fullName: string;
  initialStatus: MotoboyStatus;
  activeDeliveries: number;
  doneToday: number;
  earnedToday: number;
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
      <div className="home-map-wrap">
        <LiveMap height={300} />

        <div className="home-topbar">
          <Link href="/perfil" className="home-avatar-btn">
            <Avatar name={fullName} src={null} size={40} />
          </Link>
          <button
            type="button"
            className={`status-pill ${online ? 'on' : 'off'}`}
            onClick={toggle}
            disabled={busy}
            aria-pressed={online}
          >
            <ScooterIcon />
            {busy ? 'Um instante…' : online ? 'Disponível' : 'Indisponível'}
          </button>
          <span className="home-bell-spacer" aria-hidden />
        </div>

        {online ? (
          <div className="home-search-banner">
            <SearchIcon /> Procurando entregas para você
          </div>
        ) : (
          <div className="home-offline-hint">Toque no botão acima para ficar disponível</div>
        )}
      </div>

      {err && <p style={{ color: 'var(--danger)', margin: 0, textAlign: 'center' }}>{err}</p>}

      <div className="home-sheet">
        <div className="row" style={{ gap: 12 }}>
          <div className="panel" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrencyBRL(earnedToday)}</div>
            <div className="muted" style={{ fontSize: 13 }}>ganhos hoje</div>
          </div>
          <div className="panel" style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{doneToday}</div>
            <div className="muted" style={{ fontSize: 13 }}>entregas hoje</div>
          </div>
        </div>

        {activeDeliveries > 0 && (
          <Link href="/entrega" className="button" style={{ textAlign: 'center' }}>
            Ver entrega atual
          </Link>
        )}
      </div>
    </div>
  );
}

function ScooterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="17.5" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="17.5" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 17.5h6.2l2.3-6.5H14M17 11l-1.2-4H13m-4.6 10.5c-.4-2.2-1.7-3.5-3.9-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
