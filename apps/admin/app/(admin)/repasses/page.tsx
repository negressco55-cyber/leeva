import Link from 'next/link';
import { adminDb } from '@/lib/context';
import { listPayoutBatches } from '@leeva/shared/services';
import { money } from '../_lib/ui';
import { PayoutActions, CloseNow } from './PayoutActions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; tag: string }> = {
  pending: { label: 'Aguardando', tag: 'amber' },
  processing: { label: 'Processando', tag: 'blue' },
  paid: { label: 'Pago', tag: 'green' },
  failed: { label: 'Falhou', tag: 'red' },
  awaiting_pix: { label: 'Falta chave Pix', tag: 'orange' },
};

export default async function Repasses({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const rows = await listPayoutBatches(adminDb(), { status: sp.status, limit: 300 });

  const totals = {
    pending: rows.filter((r) => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0),
    failed: rows.filter((r) => ['failed', 'awaiting_pix'].includes(r.status)).length,
    paidToday: rows
      .filter((r) => r.status === 'paid' && r.paid_at && new Date(r.paid_at).toDateString() === new Date().toDateString())
      .reduce((s, r) => s + Number(r.amount), 0),
  };

  const filters: [string, string][] = [
    ['', 'Todos'],
    ['pending', 'Aguardando'],
    ['failed', 'Falhas'],
    ['awaiting_pix', 'Sem Pix'],
    ['paid', 'Pagos'],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Repasses</h1>
          <div className="sub">Fechamento diário — uma transferência Pix por motoboy</div>
        </div>
        <CloseNow />
      </div>

      <div className="stat-row">
        <div className="stat"><div className="v">{money(totals.pending)}</div><div className="l">A pagar (lotes aguardando)</div></div>
        <div className="stat warn"><div className="v">{totals.failed}</div><div className="l">Lotes com problema</div></div>
        <div className="stat good"><div className="v">{money(totals.paidToday)}</div><div className="l">Pago hoje</div></div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="seg" style={{ marginBottom: 10 }}>
          {filters.map(([v, l]) => (
            <Link key={v} href={v ? `/repasses?status=${v}` : '/repasses'} className={`seg-btn ${(sp.status ?? '') === v ? 'active' : ''}`}>
              {l}
            </Link>
          ))}
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Data</th>
              <th>Entregador</th>
              <th>Frota</th>
              <th style={{ textAlign: 'right' }}>Entregas</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Status</th>
              <th>Chave / ref</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const m = (b as { motoboys?: { full_name?: string; fleet?: string } }).motoboys;
              const st = STATUS[b.status] ?? { label: b.status, tag: 'gray' };
              return (
                <tr key={b.id}>
                  <td>{new Date(b.period_date).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <Link href={`/entregadores/${b.motoboy_id}`}>{m?.full_name ?? '—'}</Link>
                  </td>
                  <td>{m?.fleet === 'leeva' ? 'Rede' : 'Própria'}</td>
                  <td style={{ textAlign: 'right' }}>{b.earnings_count}</td>
                  <td style={{ textAlign: 'right' }}>{money(Number(b.amount))}</td>
                  <td>
                    <span className={`tag ${st.tag}`}>{st.label}</span>
                    {b.simulated && <span className="muted" style={{ fontSize: 11 }}> sim.</span>}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {b.external_ref ?? (b.pix_key ? `${b.pix_key_type}` : '—')}
                    {b.error ? ` · ${b.error}` : ''}
                  </td>
                  <td>{['failed', 'awaiting_pix', 'pending'].includes(b.status) && <PayoutActions batchId={b.id} />}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">Nenhum lote.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
