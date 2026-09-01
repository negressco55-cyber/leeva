'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../_lib/client';

export function ApproveButtons({ motoboyId, name }: { motoboyId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const act = (action: 'approve' | 'reject') =>
    start(async () => {
      setErr(null);
      try {
        let reason: string | undefined;
        if (action === 'reject') {
          reason = window.prompt(`Motivo da rejeição de ${name} (opcional, será mostrado ao motoboy):`) ?? undefined;
        } else if (!window.confirm(`Aprovar ${name}? Ele entra na rede de entregadores.`)) {
          return;
        }
        await apiPost(`/api/drivers/${motoboyId}/approve`, { action, reason });
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'erro');
      }
    });

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <button className="btn" disabled={pending} onClick={() => act('approve')}>
        ✅ Aprovar
      </button>
      <button className="btn" disabled={pending} onClick={() => act('reject')}>
        ❌ Rejeitar
      </button>
      {err && <span className="muted" style={{ fontSize: 12 }}>{err}</span>}
    </div>
  );
}
