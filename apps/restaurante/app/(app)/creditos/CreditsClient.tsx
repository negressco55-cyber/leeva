'use client';

import { useState, useEffect } from 'react';
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

type BuyResult = {
  balance?: number;
  simulated?: boolean;
  status?: 'pending' | 'paid';
  invoiceUrl?: string;
  pixCopyPaste?: string;
  amount?: number;
  bonus?: number;
};

export function CreditsClient({ initial, canBuy }: { initial: Data; canBuy: boolean }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pix, setPix] = useState<BuyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);

  async function refreshBalance() {
    try {
      const r = await fetch('/api/credits', { cache: 'no-store' });
      if (!r.ok) return null;
      const d = (await r.json()) as Data;
      setData(d);
      return d.balance;
    } catch {
      return null;
    }
  }

  // Enquanto há um Pix pendente, confere o saldo a cada 5s (o webhook credita sozinho).
  useEffect(() => {
    if (!pix?.invoiceUrl || pix.status !== 'pending') return;
    setWaiting(true);
    const startBalance = data.balance;
    const t = setInterval(async () => {
      const bal = await refreshBalance();
      if (bal != null && bal > startBalance) {
        setWaiting(false);
        setPix(null);
        setMsg('Pagamento confirmado — crédito liberado.');
        clearInterval(t);
        router.refresh();
      }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pix]);

  async function buy(packageId: string) {
    setBuying(packageId);
    setMsg(null);
    setPix(null);
    try {
      const r = await apiPost<BuyResult>('/api/credits', { packageId });
      if (r.simulated) {
        if (r.balance != null) setData((d) => ({ ...d, balance: r.balance! }));
        setMsg('Crédito adicionado (simulação — sem pagamento real ainda).');
        router.refresh();
      } else if (r.invoiceUrl) {
        setPix(r);
        setMsg(null);
      } else {
        setMsg('Compra registrada.');
        router.refresh();
      }
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

        {pix?.invoiceUrl && (
          <div className="op-alert" style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <strong>Pague R$ {(pix.amount ?? 0).toFixed(2)} via Pix para liberar o crédito</strong>
            {pix.pixCopyPaste && (
              <>
                <div style={{ fontSize: 12 }}>Copie o código Pix e pague no app do seu banco:</div>
                <textarea
                  readOnly
                  value={pix.pixCopyPaste}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', minHeight: 60 }}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pix.pixCopyPaste!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      /* seleção manual já funciona */
                    }
                  }}
                >
                  {copied ? 'Copiado!' : 'Copiar código Pix'}
                </button>
              </>
            )}
            <a href={pix.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
              Ou abrir a página de pagamento →
            </a>
            <div className="muted" style={{ fontSize: 12 }}>
              {waiting ? 'Aguardando o pagamento… o crédito entra automaticamente assim que o Pix cair.' : ''}
            </div>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          O crédito é liberado automaticamente após a confirmação do Pix.
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
