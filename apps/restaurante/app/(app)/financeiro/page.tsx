import Link from 'next/link';
import { requireRestaurantContext, adminDb } from '@/lib/context';
import { getLogisticsFinance, getUsageSummary, type Period } from '@leeva/shared/services';
import { formatCurrencyBRL } from '@leeva/shared';

export const dynamic = 'force-dynamic';

const PERIODS: { k: Period; l: string }[] = [
  { k: 'today', l: 'Hoje' },
  { k: 'yesterday', l: 'Ontem' },
  { k: '7d', l: '7 dias' },
  { k: '30d', l: '30 dias' },
];

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ctx = await requireRestaurantContext();
  const db = adminDb();
  const sp = await searchParams;
  const period = (PERIODS.find((p) => p.k === sp.period)?.k ?? '30d') as Period;

  const [fin, saas] = await Promise.all([
    getLogisticsFinance(db, ctx.restaurantId, period),
    getUsageSummary(db, ctx.restaurantId),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Financeiro</h1>
          <div className="sub">Receita do Leeva (assinatura) e financeiro da sua logística — separados.</div>
        </div>
        <div className="seg">
          {PERIODS.map((p) => (
            <Link key={p.k} href={`/financeiro?period=${p.k}`} className={p.k === period ? 'active' : ''}>
              {p.l}
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Seu plano Leeva — {saas.plan.name}</div>
        <div className="stat-row">
          <div className="stat"><div className="v">{formatCurrencyBRL(saas.monthlyFee)}</div><div className="l">mensalidade</div></div>
          <div className="stat"><div className="v">{saas.deliveries}</div><div className="l">entregas no período</div></div>
          <div className="stat"><div className="v">{formatCurrencyBRL(saas.plan.perDeliveryPrice)}</div><div className="l">por entrega</div></div>
          <div className="stat"><div className="v">{formatCurrencyBRL(saas.variableFee)}</div><div className="l">variável ({saas.deliveries} × {formatCurrencyBRL(saas.plan.perDeliveryPrice)})</div></div>
          <div className="stat good"><div className="v">{formatCurrencyBRL(saas.estimatedTotal)}</div><div className="l">total estimado do mês</div></div>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {saas.status === 'trialing' && saas.trialEndsAt
            ? `Em teste grátis até ${new Date(saas.trialEndsAt).toLocaleDateString('pt-BR')}.`
            : `Período: ${new Date(saas.periodStart).toLocaleDateString('pt-BR')} – ${new Date(saas.periodEnd).toLocaleDateString('pt-BR')}.`}{' '}
          <Link href="/configuracoes#plano">Ver planos</Link>
        </p>
      </div>

      <div className="card">
        <div className="card-title">Financeiro da logística — {fin.period}</div>
        {fin.deliveries === 0 ? (
          <p className="muted">Nenhuma entrega concluída no período.</p>
        ) : (
          <>
            <div className="stat-row">
              <div className="stat"><div className="v">{fin.deliveries}</div><div className="l">entregas</div></div>
              <div className="stat"><div className="v">{formatCurrencyBRL(fin.revenue)}</div><div className="l">receita da logística</div></div>
              <div className="stat warn"><div className="v">{formatCurrencyBRL(fin.driverCost)}</div><div className="l">custo dos entregadores</div></div>
              <div className={`stat ${fin.margin >= 0 ? 'good' : 'warn'}`}><div className="v">{formatCurrencyBRL(fin.margin)}</div><div className="l">margem logística</div></div>
              <div className="stat"><div className="v">{fin.avgCost != null ? formatCurrencyBRL(fin.avgCost) : '—'}</div><div className="l">custo médio / entrega</div></div>
              <div className="stat"><div className="v">{fin.avgMargin != null ? formatCurrencyBRL(fin.avgMargin) : '—'}</div><div className="l">margem média / entrega</div></div>
            </div>

            {fin.alerts.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {fin.alerts.map((a, i) => (
                  <div key={i} className={`op-alert ${a.severity === 'warning' ? 'warning' : 'info'}`}>
                    <div style={{ fontSize: 13 }}>{a.icon} {a.text}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="card-title" style={{ marginTop: 16 }}>Por região</div>
            <table className="data">
              <thead><tr><th>Região</th><th>Entregas</th><th>Custo médio</th><th>Margem média</th></tr></thead>
              <tbody>
                {fin.byRegion.slice(0, 12).map((r) => (
                  <tr key={r.region}>
                    <td>{r.region}</td>
                    <td>{r.deliveries}</td>
                    <td>{r.avgCost != null ? formatCurrencyBRL(r.avgCost) : '—'}</td>
                    <td>{r.avgMargin != null ? formatCurrencyBRL(r.avgMargin) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
