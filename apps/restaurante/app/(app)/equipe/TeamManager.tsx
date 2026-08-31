'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../_lib/client';

type Member = {
  id: string;
  full_name: string;
  phone: string;
  statusLabel: string;
  active: boolean;
  user_id: string | null;
  deliveries_completed: number;
  deliveries_late: number;
  avg_delay_min: number;
  rating: number;
  lastSeen: string | null;
};

export default function TeamManager({ team }: { team: Member[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      await apiPost('/api/team', { full_name: name, phone });
      setName('');
      setPhone('');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await apiPost('/api/team', { id, active: !active });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Adicionar entregador</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <input className="input" placeholder="Telefone (com DDD)" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <button className="btn primary" onClick={add} disabled={busy || !name.trim() || phone.replace(/\D/g, '').length < 10}>
            Adicionar
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          O entregador ativa a própria conta no app do Leeva usando o mesmo telefone.
        </p>
        {err && <div className="op-alert critical">{err}</div>}
      </div>

      <div className="card">
        <div className="card-title">Equipe ({team.length})</div>
        <table className="data">
          <thead>
            <tr><th>Nome</th><th>Status</th><th>Conta</th><th>Entregas</th><th>Atrasos</th><th>Avaliação</th><th></th></tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                <td>{m.full_name}<div className="muted" style={{ fontSize: 12 }}>{m.phone}</div></td>
                <td>{m.statusLabel}</td>
                <td>{m.user_id ? <span className="tag green">ativa</span> : <span className="tag amber">pendente</span>}</td>
                <td>{m.deliveries_completed}</td>
                <td>{m.deliveries_completed ? `${Math.round((m.deliveries_late / m.deliveries_completed) * 100)}%` : '—'}</td>
                <td>{Number(m.rating).toFixed(1)}</td>
                <td><button className="btn sm" onClick={() => toggle(m.id, m.active)}>{m.active ? 'Desativar' : 'Reativar'}</button></td>
              </tr>
            ))}
            {team.length === 0 && <tr><td colSpan={7} className="muted">Nenhum entregador cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
