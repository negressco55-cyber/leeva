'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../../_lib/client';

export function BlockButton({ motoboyId, blocked }: { motoboyId: string; blocked: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle() {
    setErr(null);
    const reason = blocked ? undefined : window.prompt('Motivo do bloqueio:') ?? undefined;
    if (!blocked && !reason) return;
    start(async () => {
      try {
        await apiPost(`/api/drivers/${motoboyId}/block`, { blocked: !blocked, reason });
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'erro');
      }
    });
  }

  return (
    <div>
      <button className="btn" onClick={toggle} disabled={pending}>
        {pending ? '…' : blocked ? 'Desbloquear' : 'Bloquear entregador'}
      </button>
      {err && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{err}</p>}
    </div>
  );
}
