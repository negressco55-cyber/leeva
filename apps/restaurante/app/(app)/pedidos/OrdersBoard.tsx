'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeOrders } from '@leeva/shared/hooks';
import {
  ORDER_STATUS_LABELS,
  ORDER_SOURCE_LABELS,
  DISPATCH_STATE_LABELS,
  OPEN_ORDER_STATUSES,
  ALLOWED_ORDER_TRANSITIONS,
  formatCurrencyBRL,
  formatDateTime,
  type OrderStatus,
  type OrderSource,
  type DispatchState,
} from '@leeva/shared';
import { StatusPill, SourcePill } from '../_lib/ui';
import { apiPost } from '../_lib/client';
import NewOrderDialog from './NewOrderDialog';
import OrderDetail from './OrderDetail';

type OrderRow = {
  id: string;
  order_number: number | null;
  source: OrderSource;
  status: OrderStatus;
  dispatch_state: DispatchState;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string;
  region: string | null;
  order_amount: number;
  delivery_fee: number;
  payment_method: string;
  payment_status: string;
  motoboy_id: string | null;
  created_at: string;
  ready_at: string | null;
  eta_min: number | null;
  eta_max: number | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  leeva_fee: number | null;
  driver_payout: number | null;
  logistics_margin: number | null;
  route_distance_km: number | null;
  order_items: { id: string; name: string; quantity: number; unit_price: number; notes: string | null }[];
};

/** Como o restaurante enxerga o andamento — status do pedido OU do despacho. */
function progressLabel(o: OrderRow): { text: string; cls: string } {
  if (['searching', 'offered'].includes(o.dispatch_state) && !o.motoboy_id) {
    return { text: DISPATCH_STATE_LABELS[o.dispatch_state], cls: 'amber' };
  }
  if (o.dispatch_state === 'failed' && !o.motoboy_id) {
    return { text: 'Sem entregador — acionando rede', cls: 'red' };
  }
  const map: Record<string, string> = {
    waiting_dispatch: 'gray',
    preparing: 'blue',
    ready: 'orange',
    assigned: 'blue',
    picked_up: 'blue',
    in_route: 'green',
    delivered: 'gray',
    cancelled: 'red',
  };
  return { text: ORDER_STATUS_LABELS[o.status], cls: map[o.status] ?? 'gray' };
}

export default function OrdersBoard({
  restaurantId,
  initialOrders,
}: {
  restaurantId: string;
  initialOrders: OrderRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { events } = useRealtimeOrders({ restaurantId });
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!events.length || openId || showNew) return;
    const t = setTimeout(() => startTransition(() => router.refresh()), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length, openId, showNew]);

  const [source, setSource] = useState<'all' | OrderSource>('all');
  const [status, setStatus] = useState<'open' | 'all' | OrderStatus>('open');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return initialOrders.filter((o) => {
      if (source !== 'all' && o.source !== source) return false;
      if (status === 'open' && !OPEN_ORDER_STATUSES.includes(o.status)) return false;
      if (status !== 'open' && status !== 'all' && o.status !== status) return false;
      if (q.trim()) {
        const n = q.trim().toLowerCase();
        const hay = `${o.order_number} ${o.customer_name} ${o.customer_phone ?? ''} ${o.customer_address} ${o.region ?? ''}`.toLowerCase();
        if (!hay.includes(n)) return false;
      }
      return true;
    });
  }, [initialOrders, source, status, q]);

  async function act(fn: () => Promise<unknown>, id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await fn();
      startTransition(() => router.refresh());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pedidos</h1>
          <div className="sub">
            O Leeva encontra o entregador automaticamente. Você acompanha e, se precisar, cancela.
          </div>
        </div>
        <button className="btn primary" onClick={() => setShowNew(true)}>
          + Nova entrega
        </button>
      </div>

      <div className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="btn sm"
          style={{ flex: 1, minWidth: 180, cursor: 'text', textAlign: 'left', fontWeight: 400 }}
          placeholder="Buscar nº, nome, telefone, endereço…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="btn sm" value={source} onChange={(e) => setSource(e.target.value as OrderSource | 'all')}>
          <option value="all">Origem: todas</option>
          {(Object.keys(ORDER_SOURCE_LABELS) as OrderSource[]).map((s) => (
            <option key={s} value={s}>{ORDER_SOURCE_LABELS[s]}</option>
          ))}
        </select>
        <select className="btn sm" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | 'open' | 'all')}>
          <option value="open">Em aberto</option>
          <option value="all">Todos</option>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {err && <div className="op-alert critical" style={{ marginTop: 10 }}>{err}</div>}
      <div className="muted" style={{ fontSize: 13, margin: '10px 0' }}>{filtered.length} pedido(s)</div>

      {filtered.map((o) => {
        const prog = progressLabel(o);
        return (
          <div key={o.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>#{o.order_number}</strong>
                  <span className={`tag ${prog.cls}`}>{prog.text}</span>
                  <SourcePill source={o.source} />
                  {o.payment_status === 'paid' ? (
                    <span className="tag green">venda paga</span>
                  ) : (
                    <span className="tag amber">receber na entrega</span>
                  )}
                  {o.eta_min != null && o.status !== 'delivered' && o.status !== 'cancelled' && (
                    <span className="muted" style={{ fontSize: 12 }}>ETA {o.eta_min}–{o.eta_max} min</span>
                  )}
                </div>
                <div style={{ marginTop: 4 }}>{o.customer_name} · {o.customer_address}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {formatDateTime(o.created_at)}
                  {o.leeva_fee != null &&
                    ` · custo ${formatCurrencyBRL(Number(o.leeva_fee))} (entregador ${formatCurrencyBRL(Number(o.driver_payout ?? 0))} + Leeva ${formatCurrencyBRL(Number(o.logistics_margin ?? 0))})`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!['delivered', 'cancelled'].includes(o.status) && (
                  <button
                    className="btn sm"
                    disabled={busyId === o.id}
                    onClick={() => {
                      if (confirm(`Cancelar o pedido #${o.order_number}?`))
                        act(() => apiPost(`/api/orders/${o.id}/status`, { status: 'cancelled' }), o.id);
                    }}
                  >
                    Cancelar
                  </button>
                )}
                <button className="btn sm" onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                  {openId === o.id ? 'Fechar' : 'Detalhes'}
                </button>
              </div>
            </div>
            {openId === o.id && (
              <OrderDetail order={o} onChanged={() => startTransition(() => router.refresh())} />
            )}
          </div>
        );
      })}

      {showNew && (
        <NewOrderDialog
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </>
  );
}
