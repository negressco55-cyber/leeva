import { adminDb } from '@/lib/context';
import { getAdminOverview, type AdminPeriod } from '@leeva/shared/services';
import { StatCard, PeriodNav, money, num } from '../_lib/ui';

export const dynamic = 'force-dynamic';

const PERIODS: AdminPeriod[] = ['today', '7d', '30d', 'month'];

export default async function VisaoGeral({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const period: AdminPeriod = PERIODS.includes(sp.p as AdminPeriod) ? (sp.p as AdminPeriod) : '30d';
  const o = await getAdminOverview(adminDb(), period);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Visão geral</h1>
          <div className="sub">O que está acontecendo na plataforma</div>
        </div>
        <PeriodNav base="/visao-geral" current={period} />
      </div>

      <div className="card">
        <div className="card-title">Receita</div>
        <div className="stat-row">
          <StatCard label="MRR (assinaturas ativas)" value={money(o.mrr)} />
          <StatCard label="Receita SaaS (período)" value={money(o.saasRevenue)} delta={o.deltas.saasRevenue} />
          <StatCard label="Receita por entrega (período)" value={money(o.deliveryRevenue)} delta={o.deltas.deliveryRevenue} />
          <StatCard label="Receita total (período)" value={money(o.totalRevenue)} delta={o.deltas.totalRevenue} />
          <StatCard label="Custo com entregadores" value={money(o.driverCost)} />
          <StatCard label="Margem logística" value={money(o.logisticsMargin)} delta={o.deltas.logisticsMargin} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Operação</div>
        <div className="stat-row">
          <StatCard label="Restaurantes ativos" value={num(o.restaurantsActive)} />
          <StatCard label="Restaurantes em trial" value={num(o.restaurantsTrial)} />
          <StatCard label="Entregas hoje" value={num(o.deliveriesToday)} delta={o.deltas.deliveries} />
          <StatCard label="Entregas nos últimos 7 dias" value={num(o.deliveries7d)} />
          <StatCard label="Motoboys cadastrados" value={num(o.motoboysRegistered)} />
          <StatCard label="Motoboys online" value={num(o.motoboysOnline)} />
          <StatCard label="Entregas sem entregador" value={num(o.deliveriesNoDriver)} hint="dispatch_state = failed" />
        </div>
      </div>
    </>
  );
}
