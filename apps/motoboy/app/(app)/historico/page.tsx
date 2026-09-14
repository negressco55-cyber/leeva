import { CheckCircle2, Inbox, Wallet, XCircle } from 'lucide-react';
import { requireMotoboyContext, adminDb } from '@/lib/context';
import { formatCurrencyBRL, formatDateTime } from '@leeva/shared';

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
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>Histórico</h1>

      <div className="hero-card">
        <div className="hero-top">
          <span className="hero-label">Total recebido</span>
          <span className="hero-icon"><Wallet size={16} strokeWidth={2} /></span>
        </div>
        <div className="hero-value">{formatCurrencyBRL(totalEarned)}</div>
        <div className="hero-hint">
          {delivered.length} entrega{delivered.length === 1 ? '' : 's'} concluída{delivered.length === 1 ? '' : 's'}
        </div>
      </div>

      {!orders?.length ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Inbox size={32} strokeWidth={1.6} /></div>
          <div className="empty-state-title">Nenhuma entrega ainda</div>
          <p className="empty-state-text">Assim que você concluir uma entrega, ela aparece aqui.</p>
        </div>
      ) : (
        <div className="tx-list">
          {orders.map((o) => {
            const ok = o.status === 'delivered';
            return (
              <div key={o.id} className="tx-item">
                <span className={`tx-icon ${ok ? 'ok' : 'cancel'}`}>
                  {ok ? <CheckCircle2 size={18} strokeWidth={2} /> : <XCircle size={18} strokeWidth={2} />}
                </span>
                <div className="tx-body">
                  <div className="tx-title">
                    Pedido #{o.order_number ?? '—'} <span className="date">· {formatDateTime(o.delivered_at ?? o.created_at)}</span>
                  </div>
                  <div className="tx-address">{o.customer_address}</div>
                </div>
                <span className={`tx-value ${ok ? '' : 'muted'}`}>{ok ? formatCurrencyBRL(o.driver_payout ?? 0) : '—'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
