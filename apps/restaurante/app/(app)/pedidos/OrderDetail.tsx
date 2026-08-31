'use client';

import { useEffect, useState } from 'react';
import {
  ORDER_STATUS_LABELS,
  DISPATCH_STATE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatCurrencyBRL,
  formatDateTime,
  type OrderStatus,
  type DispatchState,
} from '@leeva/shared';
import { apiGet, apiPost } from '../_lib/client';

type OrderRow = {
  id: string;
  order_number: number | null;
  status: OrderStatus;
  dispatch_state: DispatchState;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string;
  order_amount: number;
  delivery_fee: number;
  payment_method: string;
  payment_status: string;
  notes: string | null;
  motoboy_id: string | null;
  leeva_fee: number | null;
  driver_payout: number | null;
  logistics_margin: number | null;
  route_distance_km: number | null;
  order_items: { id: string; name: string; quantity: number; unit_price: number; notes: string | null }[];
};

type Detail = {
  order: Record<string, unknown> & {
    created_at: string;
    confirmed_at: string | null;
    dispatched_at: string | null;
    accepted_at: string | null;
    picked_up_at: string | null;
    in_route_at: string | null;
    delivered_at: string | null;
  };
  timeline: { id: number; type: string; created_at: string }[];
  trackingUrl: string | null;
  notifications: { channel: string; body: string; status: string; error: string | null }[];
  dispatchAttempts?: { attempt_number: number; outcome: string | null; reason: string | null; offered_at: string; score: number | null }[];
};

export default function OrderDetail({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Detail>(`/api/orders/${order.id}`).then(setD).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const o = d?.order;
  const stamps: [string, string | null | undefined][] = o
    ? [
        ['Criado', o.created_at],
        ['Confirmado', o.confirmed_at],
        ['Despachado', o.dispatched_at],
        ['Aceite', o.accepted_at],
        ['Coletado', o.picked_up_at],
        ['Saiu para entrega', o.in_route_at],
        ['Entregue', o.delivered_at],
      ]
    : [];

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div className="card-title">Pedido</div>
          {order.order_items.length ? (
            order.order_items.map((i) => (
              <div key={i.id} className="muted" style={{ fontSize: 13 }}>
                {i.quantity}× {i.name}
                {i.unit_price ? ` — ${formatCurrencyBRL(i.unit_price)}` : ''}
              </div>
            ))
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>itens não enviados (não são necessários à logística)</span>
          )}
          {order.customer_phone && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Tel: {order.customer_phone}</div>}
          {order.notes && <div className="muted" style={{ fontSize: 13 }}>Obs: {order.notes}</div>}

          <div className="card-title" style={{ marginTop: 14 }}>Pagamento da venda</div>
          <div style={{ fontSize: 14 }}>
            {formatCurrencyBRL(Number(order.order_amount))} —{' '}
            {PAYMENT_METHOD_LABELS[order.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? order.payment_method}
            {' · '}
            <b>{PAYMENT_STATUS_LABELS[order.payment_status as keyof typeof PAYMENT_STATUS_LABELS] ?? order.payment_status}</b>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            O Leeva não processa a venda — o dinheiro é do restaurante.
          </div>
        </div>

        <div>
          <div className="card-title">Custo da logística</div>
          <table className="data" style={{ fontSize: 13 }}>
            <tbody>
              <tr><td>Distância estimada</td><td>{order.route_distance_km != null ? `${Number(order.route_distance_km).toFixed(1)} km` : '—'}</td></tr>
              <tr><td>Taxa de entrega (logística)</td><td>{order.leeva_fee != null ? formatCurrencyBRL(Number(order.leeva_fee)) : 'a calcular'}</td></tr>
              <tr><td>Remuneração do entregador</td><td>{order.driver_payout != null ? formatCurrencyBRL(Number(order.driver_payout)) : 'a calcular'}</td></tr>
              <tr style={{ fontWeight: 700 }}><td>Margem logística</td><td>{order.logistics_margin != null ? formatCurrencyBRL(Number(order.logistics_margin)) : '—'}</td></tr>
            </tbody>
          </table>

          <div className="card-title" style={{ marginTop: 14 }}>Despacho</div>
          <div style={{ fontSize: 14 }}>
            {['searching', 'offered'].includes(order.dispatch_state)
              ? DISPATCH_STATE_LABELS[order.dispatch_state]
              : order.motoboy_id
                ? 'Entregador atribuído automaticamente'
                : DISPATCH_STATE_LABELS[order.dispatch_state]}
          </div>
          {d?.dispatchAttempts?.length ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {d.dispatchAttempts.length} tentativa(s) —{' '}
              {d.dispatchAttempts.map((a) => a.outcome ?? 'aguardando').join(', ')}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <div className="card-title">Linha do tempo</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {stamps.map(([label, iso]) => (
            <div key={label} style={{ fontSize: 12 }}>
              <div className="muted">{label}</div>
              <div>{iso ? formatDateTime(String(iso)) : '—'}</div>
            </div>
          ))}
        </div>
        <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
          {(d?.timeline ?? []).map((e) => (
            <li key={e.id} className="muted" style={{ fontSize: 12 }}>
              {formatDateTime(e.created_at)} · {e.type}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>Rastreamento do cliente:</strong>
        {d?.trackingUrl ? (
          <a href={d.trackingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{d.trackingUrl}</a>
        ) : (
          <button
            className="btn sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await apiPost<{ url: string }>(`/api/orders/${order.id}/tracking-link`);
                setD((x) => (x ? { ...x, trackingUrl: r.url } : x));
              })
            }
          >
            Gerar link
          </button>
        )}
      </div>

      {d?.notifications?.length ? (
        <div>
          <div className="card-title">Notificações</div>
          {d.notifications.map((n, i) => (
            <div key={i} className="muted" style={{ fontSize: 12 }}>
              [{n.channel}] {n.body} — <b>{n.status}</b>{n.error ? ` (${n.error})` : ''}
            </div>
          ))}
        </div>
      ) : null}

      {!['delivered', 'cancelled'].includes(order.status) && order.status !== 'waiting_dispatch' && (
        <div style={{ fontSize: 12 }} className="muted">
          Status atual: <b>{ORDER_STATUS_LABELS[order.status]}</b>. O restaurante não altera o status
          da entrega — isso é feito pelo entregador. Você pode cancelar o pedido se necessário.
        </div>
      )}

      {err && <div className="op-alert critical">{err}</div>}
    </div>
  );
}
