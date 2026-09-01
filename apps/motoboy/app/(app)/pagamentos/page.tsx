import { requireMotoboyContext, adminDb } from '@/lib/context';
import { getMotoboyPixInfo, getPendingEarnings, getPayoutHistory } from '@leeva/shared/services';
import { PixForm } from './PixForm';
import { formatCurrencyBRL } from '@leeva/shared';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  processing: 'Processando',
  paid: 'Pago',
  failed: 'Falhou',
  awaiting_pix: 'Falta chave Pix',
};

export default async function PagamentosPage() {
  const ctx = await requireMotoboyContext();
  const db = adminDb();
  const [pix, pending, history] = await Promise.all([
    getMotoboyPixInfo(db, ctx.motoboyId),
    getPendingEarnings(db, ctx.motoboyId),
    getPayoutHistory(db, ctx.motoboyId, 30),
  ]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <h1 style={{ margin: 0 }}>Pagamentos</h1>

      <div className="panel">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>A receber</h2>
        <div style={{ fontSize: 30, fontWeight: 650 }}>{formatCurrencyBRL(pending.amount)}</div>
        <p className="muted" style={{ fontSize: 12 }}>
          {pending.count} entrega(s) fechando no próximo repasse. O pagamento é feito uma vez por dia, via Pix.
        </p>
      </div>

      <PixForm initial={{ masked: pix.masked, type: pix.pixKeyType }} />

      <div className="panel">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Repasses recebidos</h2>
        {history.length === 0 && <p className="muted">Nenhum repasse ainda.</p>}
        {history.map((b) => (
          <div
            key={b.id}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {new Date(b.periodDate).toLocaleDateString('pt-BR')} · {b.earningsCount} entrega(s)
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {STATUS_LABEL[b.status] ?? b.status}
                {b.simulated ? ' (simulação)' : ''}
                {b.status === 'paid' && b.paidAt ? ` em ${new Date(b.paidAt).toLocaleDateString('pt-BR')}` : ''}
                {b.error ? ` — ${b.error}` : ''}
              </div>
            </div>
            <strong style={{ color: b.status === 'paid' ? 'var(--ok)' : undefined }}>{formatCurrencyBRL(b.amount)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
