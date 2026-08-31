import { adminDb } from '@/lib/context';
import { getAdminFinance, type AdminPeriod } from '@leeva/shared/services';
import { StatCard, PeriodNav, money, num } from '../_lib/ui';

export const dynamic = 'force-dynamic';
const PERIODS: AdminPeriod[] = ['today', '7d', '30d', 'month'];

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const period: AdminPeriod = PERIODS.includes(sp.p as AdminPeriod) ? (sp.p as AdminPeriod) : '30d';
  const f = await getAdminFinance(adminDb(), period, Number(process.env.LEEVA_EXTERNAL_COSTS ?? 0));
  const u = f.unitEconomics;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Financeiro</h1>
          <div className="sub">Receita SaaS × variável × custos × margem</div>
        </div>
        <PeriodNav base="/financeiro" current={period} />
      </div>

      <div className="card">
        <div className="card-title">Resultado do período</div>
        <div className="stat-row">
          <StatCard label="Receita SaaS (mensalidades)" value={money(f.saasRevenue)} />
          <StatCard label="Receita variável (taxas por entrega)" value={money(f.variableRevenue)} />
          <StatCard label="Receita total" value={money(f.totalRevenue)} />
          <StatCard label="Custo com payouts" value={money(f.costs.driverPayouts)} />
          <StatCard label="Custos externos" value={money(f.costs.external)} hint="LEEVA_EXTERNAL_COSTS (infra, gateway, mapas)" />
          <StatCard label="Margem" value={money(f.margin)} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Unit economics</div>
        <div className="stat-row">
          <StatCard label="Restaurantes faturados" value={num(u.restaurantsBilled)} />
          <StatCard label="Entregas" value={num(u.deliveries)} />
          <StatCard label="Receita média / restaurante" value={money(u.revenuePerRestaurant)} />
          <StatCard label="Receita média / entrega" value={money(u.revenuePerDelivery)} />
          <StatCard label="Custo médio / entrega" value={money(u.costPerDelivery)} />
          <StatCard label="Margem / entrega" value={money(u.marginPerDelivery)} />
          <StatCard label="Margem / restaurante" value={money(u.marginPerRestaurant)} />
          <StatCard label="Entregas médias / restaurante" value={u.deliveriesPerRestaurant == null ? '—' : String(u.deliveriesPerRestaurant)} />
          <StatCard label="MRR" value={money(u.mrr)} />
          <StatCard label="Churn mensal" value={u.churnRate == null ? '—' : `${u.churnRate}%`} />
          <StatCard label="LTV" value={money(u.ltv)} hint={u.ltvNote} />
        </div>
        {u.ltvNote && <p className="muted" style={{ fontSize: 12 }}>⚠️ {u.ltvNote}</p>}
      </div>
    </>
  );
}
