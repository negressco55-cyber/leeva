'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrencyBRL, formatDateTime } from '@leeva/shared';
import { apiPost } from '../_lib/client';

type Entry = {
  id: string;
  kind: string;
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  description: string;
  createdAt: string;
};
type Pkg = { id: string; amount: number; bonus: number; label: string | null };
type Data = {
  balance: number;
  isLow: boolean;
  lowThreshold: number;
  history: Entry[];
  packages: Pkg[];
};

const KIND_LABEL: Record<string, string> = {
  purchase: 'Compra',
  bonus: 'Bônus',
  consumption: 'Entrega',
  refund: 'Estorno',
  adjustment: 'Ajuste',
};

export function CreditsClient({ initial, canBuy }: { initial: Data; canBuy: boolean }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function buy(packageId: string) {
    setBuying(packageId);
    setMsg(null);
    try {
      const r = await apiPost<{ balance: number; simulated?: boolean }>('/api/credits', { packageId });
      setData((d) => ({ ...d, balance: r.balance }));
      setMsg(r.simulated ? 'Crédito adicionado (simulação — sem pagamento real ainda).' : 'Crédito adicionado.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'erro');
    } finally {
      setBuying(null);
    }
  }

  return (
    <>
      <div className="card" style={{ borderLeft: `3px solid ${data.isLow ? '#dc2626' : '#16a34a'}` }}>
        <div className="card-title">Saldo atual</div>
        <div style={{ fontSize: 34, fontWeight: 650 }}>{formatCurrencyBRL(data.balance)}</div>
        {data.isLow && (
          <div className="op-alert warning" style={{ marginTop: 8 }}>
            Saldo baixo (abaixo de {formatCurrencyBRL(data.lowThreshold)}). Compre créditos para não parar de despachar.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Comprar créditos</div>
        {!canBuy && <p className="muted" style={{ fontSize: 13 }}>Só o dono do restaurante pode comprar créditos.</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {data.packages.map((p) => (
            <button
              key={p.id}
              className="btn"
              disabled={!canBuy || buying === p.id}
              onClick={() => buy(p.id)}
              style={{ minWidth: 130 }}
            >
              {buying === p.id ? '…' : formatCurrencyBRL(p.amount)}
              {p.bonus > 0 && <span className="muted" style={{ fontSize: 11 }}> +{formatCurrencyBRL(p.bonus)} bônus</span>}
            </button>
          ))}
        </div>
        {msg && <div className="op-alert ok" style={{ marginTop: 10 }}>{msg}</div>}
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Pagamento via Pix na próxima etapa. Por enquanto, a compra é simulada.
        </p>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="card-title">Histórico</div>
        <table className="data" style={{ fontSize: 13, width: '100%' }}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th style={{ textAlign: 'right' }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((e) => (
              <tr key={e.id}>
                <td>{formatDateTime(e.createdAt)}</td>
                <td>{KIND_LABEL[e.kind] ?? e.kind}</td>
                <td>{e.description}</td>
                <td style={{ textAlign: 'right', color: e.amount < 0 ? 'var(--danger)' : 'var(--ok)' }}>
                  {e.amount < 0 ? '−' : '+'}
                  {formatCurrencyBRL(Math.abs(e.amount))}
                </td>
                <td style={{ textAlign: 'right' }}>{formatCurrencyBRL(e.balanceAfter)}</td>
              </tr>
            ))}
            {data.history.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">Nenhuma movimentação ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
