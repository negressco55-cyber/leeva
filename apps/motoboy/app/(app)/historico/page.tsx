import { requireMotoboyContext, adminDb } from '@/lib/context';
import { formatCurrencyBRL, formatDateTime, minutesBetween } from '@leeva/shared';

export const dynamic = 'force-dynamic';

export default async function HistoricoPage() {
  const ctx = await requireMotoboyContext();
  const db = adminDb();

  const { data: orders } = await db
    .from('orders')
    .select('id, order_number, status, customer_name, customer_address, driver_payout, created_at, delivered_at, cancelled_at')
    .eq('motoboy_id', ctx.motoboyId)
    .in('status', ['delivered', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(50);

  const delivered = (orders ?? []).filter((o) => o.status === 'delivered');
  const totalEarned = delivered.reduce((s, o) => s + Number(o.driver_payout ?? 0), 0);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <h1 style={{ margin: 0 }}>Histórico</h1>
      <div className="row" style={{ gap: 12 }}>
        <div className="panel" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{delivered.length}</div>
          <div className="muted" style={{ fontSize: 12 }}>entregas</div>
        </div>
        <div className="panel" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{formatCurrencyBRL(totalEarned)}</div>
          <div className="muted" style={{ fontSize: 12 }}>recebido</div>
        </div>
      </div>

      {(orders ?? []).map((o) => (
        <div key={o.id} className="panel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>#{o.order_number}</strong>
            <span className="badge">{o.status === 'delivered' ? 'Entregue' : 'Cancelado'}</span>
          </div>
          <div style={{ fontSize: 14 }}>{o.customer_name} — {o.customer_address}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {formatDateTime(o.created_at)}
            {o.delivered_at
              ? ` · ${minutesBetween(o.created_at, o.delivered_at)} min · ${formatCurrencyBRL(o.driver_payout ?? 0)}`
              : ''}
          </div>
        </div>
      ))}
      {!orders?.length && <p className="muted">Nenhuma entrega finalizada ainda.</p>}
    </div>
  );
}
