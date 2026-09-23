'use client';

import { useState } from 'react';
import { apiPost } from '../_lib/client';

type KnownDriver = {
  motoboyId: string;
  name: string;
  deliveriesForRestaurant: number;
  lastDeliveryAt: string | null;
  pref: 'favorite' | 'blocked' | null;
};

/** Favoritar prioriza o motoboy no despacho automático (ganha pontos extra
 *  no score). Bloquear faz esse motoboy nunca mais receber oferta dos seus
 *  pedidos — não afeta os outros restaurantes. */
export function EntregadoresClient({ initialDrivers }: { initialDrivers: KnownDriver[] }) {
  const [drivers, setDrivers] = useState(initialDrivers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function setPref(motoboyId: string, kind: 'favorite' | 'blocked' | null) {
    setBusyId(motoboyId);
    setErr(null);
    try {
      await apiPost('/api/entregadores', { motoboyId, kind });
      setDrivers((ds) => ds.map((d) => (d.motoboyId === motoboyId ? { ...d, pref: kind } : d)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (!drivers.length) {
    return (
      <div className="card muted">
        Nenhum entregador ainda. Assim que um motoboy concluir uma entrega pra você, ele aparece aqui.
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        ⭐ Favorito ganha prioridade no despacho automático. 🚫 Bloqueado nunca mais recebe oferta dos seus pedidos.
      </p>
      {err && <div className="op-alert critical">{err}</div>}
      <table className="tbl">
        <thead>
          <tr>
            <th>Nome</th>
            <th style={{ textAlign: 'right' }}>Entregas pra você</th>
            <th>Última entrega</th>
            <th>Situação</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.motoboyId}>
              <td>
                {d.name}
                {d.pref === 'favorite' && <span className="tag" style={{ marginLeft: 6 }}>⭐ favorito</span>}
                {d.pref === 'blocked' && <span className="tag red" style={{ marginLeft: 6 }}>🚫 bloqueado</span>}
              </td>
              <td style={{ textAlign: 'right' }}>{d.deliveriesForRestaurant}</td>
              <td>{d.lastDeliveryAt ? new Date(d.lastDeliveryAt).toLocaleDateString('pt-BR') : '—'}</td>
              <td className="muted">{d.pref === 'favorite' ? 'Favorito' : d.pref === 'blocked' ? 'Bloqueado' : 'Normal'}</td>
              <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {d.pref !== 'favorite' && (
                  <button className="btn sm" disabled={busyId === d.motoboyId} onClick={() => setPref(d.motoboyId, 'favorite')}>
                    ⭐ Favoritar
                  </button>
                )}
                {d.pref !== 'blocked' && (
                  <button className="btn sm" disabled={busyId === d.motoboyId} onClick={() => setPref(d.motoboyId, 'blocked')}>
                    🚫 Bloquear
                  </button>
                )}
                {d.pref != null && (
                  <button className="btn sm" disabled={busyId === d.motoboyId} onClick={() => setPref(d.motoboyId, null)}>
                    Remover
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
