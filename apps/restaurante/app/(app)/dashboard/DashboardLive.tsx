'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRealtimeOrders } from '@leeva/shared/hooks';
import type { Situation } from '@leeva/shared/services';
import type { OverviewMetrics } from '@leeva/shared/services';
import { formatCurrencyBRL } from '@leeva/shared';
import { apiPost } from '../_lib/client';

type EvaluatedAlert = { key: string; severity: string; title: string; message: string };

export function DashboardLive({
  restaurantId,
  initialSituation,
  initialAlerts,
  overview,
}: {
  restaurantId: string;
  initialSituation: Situation;
  initialAlerts: EvaluatedAlert[];
  overview: OverviewMetrics;
}) {
  const [situation, setSituation] = useState(initialSituation);
  const [alerts, setAlerts] = useState(initialAlerts);
  const { orders } = useRealtimeOrders({ restaurantId });

  const refresh = useCallback(async () => {
    try {
      const r = await apiPost<{ alerts: { active: EvaluatedAlert[] }; situation: Situation }>(
        '/api/alerts/evaluate',
      );
      setSituation(r.situation);
      setAlerts(r.alerts.active);
    } catch {
      /* ignora */
    }
  }, []);

  // re-avalia quando pedidos mudam (realtime, com debounce) e a cada 60s.
  // O debounce evita reavaliar a cada evento numa rajada de pedidos.
  useEffect(() => {
    const t = setTimeout(refresh, 4000);
    return () => clearTimeout(t);
  }, [orders.length, refresh]);
  useEffect(() => {
    const iv = setInterval(refresh, 60000);
    return () => clearInterval(iv);
  }, [refresh]);

  const c = situation.counters;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <section className={`alert-line ${situation.level}`}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>
          {situation.emoji} {situation.headline}
        </div>
        {situation.lines.map((l, i) => (
          <div key={i} style={{ marginTop: 4 }}>
            {l}
          </div>
        ))}
        {situation.action && (
          <div style={{ marginTop: 8, fontWeight: 600 }}>{situation.action}</div>
        )}
      </section>

      <section className="cards">
        <Link href="/pedidos" className="kpi">
          <div className="big">{c.total}</div>
          <div className="lbl">pedidos em andamento</div>
        </Link>
        <Link href="/despacho" className="kpi">
          <div className="big">{c.toDispatch}</div>
          <div className="lbl">para despachar</div>
        </Link>
        <div className="kpi">
          <div className="big">{c.inRoute}</div>
          <div className="lbl">em rota</div>
        </div>
        <div className="kpi">
          <div className="big" style={{ color: c.late ? 'var(--danger)' : undefined }}>
            {c.late}
          </div>
          <div className="lbl">atrasados</div>
        </div>
        <Link href="/motoboys" className="kpi">
          <div className="big">
            {c.driversAvailable}
            <span className="lbl"> / {c.driversAvailable + c.driversOnDelivery}</span>
          </div>
          <div className="lbl">motoboys livres</div>
        </Link>
      </section>

      {alerts.filter((a) => a.severity !== 'ok').length > 0 && (
        <section>
          <h2 style={{ fontSize: 15 }}>Alertas</h2>
          {alerts
            .filter((a) => a.severity !== 'ok')
            .map((a) => (
              <div key={a.key} className={`alert-line ${a.severity}`}>
                <strong>{a.title}</strong>
                <div>{a.message}</div>
              </div>
            ))}
        </section>
      )}

      <section className="panel">
        <div className="spread">
          <h2 style={{ fontSize: 15, margin: 0 }}>Resumo de hoje</h2>
          <Link href="/indicadores" className="badge">
            Ver indicadores
          </Link>
        </div>
        <div className="cards" style={{ marginTop: 12 }}>
          <div className="kpi">
            <div className="big">{overview.delivered}</div>
            <div className="lbl">entregas concluídas</div>
          </div>
          <div className="kpi">
            <div className="big">{overview.avgDeliveryMin ?? '—'}{overview.avgDeliveryMin ? ' min' : ''}</div>
            <div className="lbl">tempo médio</div>
          </div>
          <div className="kpi">
            <div className="big">{overview.lateRate != null ? `${overview.lateRate}%` : '—'}</div>
            <div className="lbl">taxa de atraso</div>
          </div>
          <div className="kpi">
            <div className="big">{overview.avgCost != null ? formatCurrencyBRL(overview.avgCost) : '—'}</div>
            <div className="lbl">custo médio de entrega</div>
          </div>
        </div>
      </section>
    </div>
  );
}
