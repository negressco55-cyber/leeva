import Link from 'next/link';
import { requireRestaurantContext, adminDb } from '@/lib/context';
import { getIndicators, type Period } from '@leeva/shared/services';
import { formatCurrencyBRL, ORDER_SOURCE_LABELS, type OrderSource } from '@leeva/shared';

export const dynamic = 'force-dynamic';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
];

export default async function IndicadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const ctx = await requireRestaurantContext();
  const db = adminDb();
  const sp = await searchParams;
  const period = (PERIODS.find((p) => p.key === sp.period)?.key ?? '7d') as Period;

  const { overview, drivers, regions, truncated } = await getIndicators(db, ctx.restaurantId, period);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="spread">
        <h1 style={{ margin: 0 }}>Indicadores</h1>
        <div className="row">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/indicadores?period=${p.key}`}
              className="badge"
              style={p.key === period ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
        {overview.period}. Todos os números vêm do banco. Distância é estimada (linha reta ×
        fator de rua) enquanto não houver provedor de mapas configurado.
        {truncated && ' ⚠️ Volume alto no período — números calculados sobre a amostra mais recente.'}
      </p>

      <section className="cards">
        <Kpi label="entregas realizadas" value={overview.delivered} />
        <Kpi label="tempo médio" value={overview.avgDeliveryMin != null ? `${overview.avgDeliveryMin} min` : '—'} />
        <Kpi label="distância média" value={overview.avgDistanceKm != null ? `${overview.avgDistanceKm} km` : '—'} />
        <Kpi label="custo médio" value={overview.avgCost != null ? formatCurrencyBRL(overview.avgCost) : '—'} />
        <Kpi label="taxa de atraso" value={overview.lateRate != null ? `${overview.lateRate}%` : '—'} />
        <Kpi label="taxa de cancelamento" value={overview.cancelRate != null ? `${overview.cancelRate}%` : '—'} />
        <Kpi label="em andamento" value={overview.inProgress} />
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Pedidos por origem</h2>
        {overview.bySource.length ? (
          <table className="data">
            <tbody>
              {overview.bySource.map((s) => (
                <tr key={s.source}>
                  <td>{ORDER_SOURCE_LABELS[s.source as OrderSource] ?? s.source}</td>
                  <td>{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Sem pedidos no período.</p>
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Por motoboy</h2>
        {drivers.length ? (
          <table className="data">
            <thead>
              <tr>
                <th>Motoboy</th>
                <th>Entregas</th>
                <th>Ganhos (taxa)</th>
                <th>Tempo médio</th>
                <th>Distância</th>
                <th>Conclusão</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.motoboyId}>
                  <td>{d.name}</td>
                  <td>{d.deliveries}</td>
                  <td>{formatCurrencyBRL(d.revenue)}</td>
                  <td>{d.avgTimeMin != null ? `${d.avgTimeMin} min` : '—'}</td>
                  <td>{d.distanceKm != null ? `${d.distanceKm} km` : '—'}</td>
                  <td>{d.completionRate != null ? `${d.completionRate}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Sem dados de motoboy no período.</p>
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Por região</h2>
        {regions.length ? (
          <table className="data">
            <thead>
              <tr>
                <th>Região</th>
                <th>Entregas</th>
                <th>Tempo médio</th>
                <th>Atrasos</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.region}>
                  <td>{r.region}</td>
                  <td>{r.deliveries}</td>
                  <td>{r.avgTimeMin != null ? `${r.avgTimeMin} min` : '—'}</td>
                  <td>{r.lateRate != null ? `${r.lateRate}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Sem dados de região no período.</p>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="kpi">
      <div className="big">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}
