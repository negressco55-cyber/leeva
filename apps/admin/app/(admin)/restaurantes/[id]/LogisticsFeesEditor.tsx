'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../../_lib/client';

export function LogisticsFeesEditor({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: { customerFee: number; minOrder: number; freeDeliveryMinOrder: number | null };
}) {
  const router = useRouter();
  const [customerFee, setCustomerFee] = useState(String(initial.customerFee));
  const [minOrder, setMinOrder] = useState(String(initial.minOrder));
  const [freeDeliveryMinOrder, setFreeDeliveryMinOrder] = useState(String(initial.freeDeliveryMinOrder ?? 0));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await apiPost(`/api/restaurants/${restaurantId}/logistics`, {
        customerFee: Number(customerFee),
        minOrder: Number(minOrder),
        freeDeliveryMinOrder: Number(freeDeliveryMinOrder) || null,
      });
      setMsg('Salvo.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <label>Taxa cobrada do cliente (R$)
          <input className="input" type="number" step="0.5" value={customerFee} onChange={(e) => setCustomerFee(e.target.value)} />
        </label>
        <label>Pedido mínimo (R$)
          <input className="input" type="number" step="0.5" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
        </label>
        <label>Frete grátis acima de (R$, 0 = desligado)
          <input className="input" type="number" step="0.5" value={freeDeliveryMinOrder} onChange={(e) => setFreeDeliveryMinOrder(e.target.value)} />
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn sm" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</button>
        {msg && <span className="muted" style={{ fontSize: 12 }}>{msg}</span>}
      </div>
    </div>
  );
}
