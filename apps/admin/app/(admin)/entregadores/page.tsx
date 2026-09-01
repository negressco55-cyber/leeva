import Link from 'next/link';
import { adminDb } from '@/lib/context';
import { listDrivers } from '@leeva/shared/services';
import { num, pctText } from '../_lib/ui';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = { offline: 'Offline', available: 'Disponível', on_delivery: 'Em entrega' };

export default async function Entregadores({ searchParams }: { searchParams: Promise<{ fleet?: string; status?: string }> }) {
  const sp = await searchParams;
  const { rows, totals } = await listDrivers(adminDb(), {
    fleet: sp.fleet === 'own' || sp.fleet === 'leeva' ? sp.fleet : undefined,
    status: sp.status,
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Entregadores</h1>
          <div className="sub">Rede Leeva + frotas próprias</div>
        </div>
        <div className="seg">
          <Link href="/entregadores" className={`seg-btn ${!sp.fleet ? 'active' : ''}`}>Todos</Link>
          <Link href="/entregadores?fleet=leeva" className={`seg-btn ${sp.fleet === 'leeva' ? 'active' : ''}`}>Rede</Link>
          <Link href="/entregadores?fleet=own" className={`seg-btn ${sp.fleet === 'own' ? 'active' : ''}`}>Próprios</Link>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><div className="v">{num(totals.total)}</div><div className="l">Total</div></div>
        <div className="stat good"><div className="v">{num(totals.online)}</div><div className="l">Online</div></div>
        <div className="stat"><div className="v">{num(totals.offline)}</div><div className="l">Offline</div></div>
        <div className="stat"><div className="v">{num(totals.onDelivery)}</div><div className="l">Em entrega</div></div>
        <div className="stat"><div className="v">{num(totals.available)}</div><div className="l">Disponíveis</div></div>
        <div className="stat warn"><div className="v">{num(totals.blocked)}</div><div className="l">Bloqueados</div></div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Frota</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Entregas</th>
              <th style={{ textAlign: 'right' }}>Aceitação</th>
              <th style={{ textAlign: 'right' }}>Finalização</th>
              <th style={{ textAlign: 'right' }}>Pontualidade</th>
              <th style={{ textAlign: 'right' }}>Avaliação</th>
              <th style={{ textAlign: 'right' }}>Confiabilidade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={`/entregadores/${m.id}`}>{m.name}</Link>
                  {m.blocked && <span className="tag red" style={{ marginLeft: 6 }}>bloqueado</span>}
                </td>
                <td>{m.fleet === 'leeva' ? 'Rede' : 'Própria'}</td>
                <td>{STATUS[m.status] ?? m.status}</td>
                <td style={{ textAlign: 'right' }}>{num(m.deliveriesTotal)}</td>
                <td style={{ textAlign: 'right' }}>{pctText(Math.round(m.acceptanceRate))}</td>
                <td style={{ textAlign: 'right' }}>{pctText(Math.round(m.completionRate))}</td>
                <td style={{ textAlign: 'right' }}>{pctText(Math.round(m.punctualityRate))}</td>
                <td style={{ textAlign: 'right' }}>{m.rating.toFixed(1)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: m.reliabilityIndex < 50 ? 'var(--danger)' : m.reliabilityIndex < 70 ? 'var(--warn)' : 'var(--ok)' }}>
                  {Math.round(m.reliabilityIndex)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="muted">Nenhum entregador.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
