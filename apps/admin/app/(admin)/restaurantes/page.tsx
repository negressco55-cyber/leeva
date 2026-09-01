import Link from 'next/link';
import { adminDb } from '@/lib/context';
import { listRestaurants } from '@leeva/shared/services';
import { money, num } from '../_lib/ui';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  trialing: 'Trial',
  past_due: 'Inadimplente',
  canceled: 'Cancelado',
};

export default async function Restaurantes({ searchParams }: { searchParams: Promise<{ status?: string; plan?: string }> }) {
  const sp = await searchParams;
  const rows = await listRestaurants(adminDb(), { status: sp.status, plan: sp.plan });

  const filters: [string, string][] = [
    ['', 'Todos'],
    ['active', 'Ativos'],
    ['trialing', 'Trial'],
    ['past_due', 'Inadimplentes'],
    ['canceled', 'Cancelados'],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Restaurantes</h1>
          <div className="sub">{rows.length} restaurante(s)</div>
        </div>
        <div className="seg">
          {filters.map(([v, l]) => (
            <Link key={v} href={v ? `/restaurantes?status=${v}` : '/restaurantes'} className={`seg-btn ${(sp.status ?? '') === v ? 'active' : ''}`}>
              {l}
            </Link>
          ))}
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Frota</th>
              <th style={{ textAlign: 'right' }}>Entregas 30d</th>
              <th style={{ textAlign: 'right' }}>MRR</th>
              <th style={{ textAlign: 'right' }}>Crédito</th>
              <th>Cadastro</th>
              <th>Última atividade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/restaurantes/${r.id}`}>{r.name}</Link>
                  {!r.onboardingCompleted && <span className="tag gray" style={{ marginLeft: 6 }}>onboarding pendente</span>}
                </td>
                <td>{r.plan ?? '—'}</td>
                <td>
                  <span className={`tag ${r.status === 'active' ? 'green' : r.status === 'trialing' ? 'blue' : r.status === 'past_due' ? 'amber' : 'gray'}`}>
                    {STATUS_LABEL[r.status ?? ''] ?? r.status ?? '—'}
                  </span>
                </td>
                <td>{r.fleetMode}</td>
                <td style={{ textAlign: 'right' }}>{num(r.deliveries30d)}</td>
                <td style={{ textAlign: 'right' }}>{money(r.mrr)}</td>
                <td style={{ textAlign: 'right', color: r.creditBalance < 20 ? 'var(--danger)' : undefined }}>{money(r.creditBalance)}</td>
                <td>{new Date(r.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>{r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">Nenhum restaurante.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
