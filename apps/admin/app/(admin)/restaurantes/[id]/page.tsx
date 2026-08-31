import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/context';
import { getRestaurantDetail } from '@leeva/shared/services';
import { money, num } from '../../_lib/ui';
import { CreditAdjust } from './CreditAdjust';

export const dynamic = 'force-dynamic';

export default async function RestaurantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getRestaurantDetail(adminDb(), id);
  if (!d) notFound();

  const r = d.restaurant;
  const sub = d.subscription as
    | { status?: string; trial_ends_at?: string | null; current_period_end?: string; plans?: { name?: string; monthly_price?: number; per_delivery_price?: number } }
    | null;
  const lc = (r.logistics_config ?? {}) as Record<string, unknown>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{r.name}</h1>
          <div className="sub">
            <Link href="/restaurantes">← Restaurantes</Link>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Dados</div>
          <dl className="kv">
            <dt>Endereço</dt>
            <dd>{r.address ?? '—'}</dd>
            <dt>Telefone</dt>
            <dd>{r.phone ?? '—'}</dd>
            <dt>Coordenadas</dt>
            <dd>{r.latitude != null ? `${r.latitude}, ${r.longitude}` : '—'}</dd>
            <dt>Frota</dt>
            <dd>{r.fleet_mode}</dd>
            <dt>Onboarding</dt>
            <dd>{r.onboarding_completed ? 'Concluído' : 'Pendente'}</dd>
            <dt>Cadastro</dt>
            <dd>{new Date(r.created_at).toLocaleString('pt-BR')}</dd>
            <dt>Equipe</dt>
            <dd>{d.team.map((u) => `${u.full_name ?? '—'} (${u.role})`).join(', ') || '—'}</dd>
          </dl>
        </div>

        <div className="card">
          <div className="card-title">Assinatura</div>
          {sub ? (
            <dl className="kv">
              <dt>Plano</dt>
              <dd>{sub.plans?.name ?? '—'}</dd>
              <dt>Status</dt>
              <dd>{sub.status}</dd>
              <dt>Mensalidade</dt>
              <dd>{money(sub.plans?.monthly_price)}</dd>
              <dt>Por entrega</dt>
              <dd>{money(sub.plans?.per_delivery_price)}</dd>
              <dt>Trial até</dt>
              <dd>{sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString('pt-BR') : '—'}</dd>
              <dt>Período atual até</dt>
              <dd>{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('pt-BR') : '—'}</dd>
            </dl>
          ) : (
            <p className="muted">Sem assinatura.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Utilização (últimos 30 dias)</div>
        <div className="stat-row">
          <div className="stat"><div className="v">{num(d.usage30d.delivered)}</div><div className="l">Entregas concluídas</div></div>
          <div className="stat"><div className="v">{num(d.usage30d.ordersCreated)}</div><div className="l">Pedidos criados</div></div>
          <div className="stat"><div className="v">{money(d.usage30d.logisticsRevenue)}</div><div className="l">Receita logística</div></div>
          <div className="stat"><div className="v">{money(d.usage30d.driverCost)}</div><div className="l">Custo entregadores</div></div>
          <div className="stat"><div className="v">{money(d.usage30d.logisticsMargin)}</div><div className="l">Margem logística</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Crédito</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: d.credits.balance < 20 ? '#fca5a5' : undefined }}>
          {money(d.credits.balance)}
        </div>
        <CreditAdjust restaurantId={id} />
        {d.credits.history.length > 0 && (
          <table className="tbl" style={{ marginTop: 10 }}>
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Saldo</th></tr></thead>
            <tbody>
              {d.credits.history.map((h, i) => (
                <tr key={i}>
                  <td>{new Date(h.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{h.kind}</td>
                  <td>{h.description}</td>
                  <td style={{ textAlign: 'right' }}>{money(Number(h.amount))}</td>
                  <td style={{ textAlign: 'right' }}>{money(Number(h.balance_after))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Configuração logística</div>
          <dl className="kv">
            {Object.entries(lc).map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v == null ? '—' : String(v)}</dd>
              </div>
            ))}
          </dl>
          {d.payoutPolicy && (
            <>
              <div className="card-title" style={{ marginTop: 12 }}>Política de remuneração ({d.payoutPolicy.name})</div>
              <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(d.payoutPolicy.config, null, 2)}</pre>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">Integrações</div>
          {d.integrations.length ? (
            <table className="tbl">
              <thead><tr><th>Provedor</th><th>Status</th><th>Credencial</th><th>Último evento</th></tr></thead>
              <tbody>
                {d.integrations.map((i) => (
                  <tr key={i.provider}>
                    <td>{i.provider}</td>
                    <td>{i.status}</td>
                    <td>{i.credentials_set ? 'sim' : 'não'}</td>
                    <td>{i.last_event_at ? new Date(i.last_event_at).toLocaleString('pt-BR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Nenhuma integração configurada.</p>
          )}

          <div className="card-title" style={{ marginTop: 12 }}>Faturamento recente</div>
          {d.recentBilling.length ? (
            <table className="tbl">
              <thead><tr><th>Data</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Valor</th><th>Descrição</th></tr></thead>
              <tbody>
                {d.recentBilling.map((b, i) => (
                  <tr key={i}>
                    <td>{new Date(b.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>{b.type}</td>
                    <td style={{ textAlign: 'right' }}>{money(b.amount)}</td>
                    <td>{b.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Sem eventos de faturamento.</p>
          )}
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12 }}>
        O admin visualiza a operação para suporte. O isolamento entre restaurantes e as permissões continuam valendo.
      </p>
    </>
  );
}
