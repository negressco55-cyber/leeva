'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRealtimeOrders } from '@leeva/shared/hooks';
import {
  DISPATCH_STATE_LABELS,
  ORDER_STATUS_LABELS,
  formatCurrencyBRL,
  type DispatchState,
} from '@leeva/shared';
import type { Situation, MapData } from '@leeva/shared/services';
import { apiGet, apiPost } from '../_lib/client';
import LeevaMap, { type MapMarker } from '../_lib/LeevaMap';

type Alert = { key: string; severity: string; title: string; message: string };

export default function OpsCenter({
  restaurantId,
  initialSituation,
  initialAlerts,
  initialMap,
  mapConfig,
  finance,
}: {
  restaurantId: string;
  initialSituation: Situation;
  initialAlerts: Alert[];
  initialMap: MapData;
  mapConfig: { tileUrl: string; attribution: string };
  finance: { deliveries: number; cost: number; margin: number; avgCost: number | null };
}) {
  const router = useRouter();
  const [clock, setClock] = useState<string>('');
  useEffect(() => {
    setClock(new Date().toLocaleTimeString('pt-BR'));
    const i = setInterval(() => setClock(new Date().toLocaleTimeString('pt-BR')), 1000);
    return () => clearInterval(i);
  }, []);
  const [situation, setSituation] = useState(initialSituation);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [map, setMap] = useState(initialMap);
  const [focusId, setFocusId] = useState<string | null>(null);
  const { orders: rtOrders } = useRealtimeOrders({ restaurantId });

  const refresh = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([
        apiPost<{ alerts: { active: Alert[] }; situation: Situation }>('/api/alerts/evaluate'),
        apiGet<MapData>('/api/map'),
      ]);
      setSituation(a.situation);
      setAlerts(a.alerts.active);
      setMap(m);
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(refresh, 2500);
    return () => clearTimeout(t);
  }, [rtOrders.length, refresh]);
  useEffect(() => {
    const iv = setInterval(refresh, 12000);
    return () => clearInterval(iv);
  }, [refresh]);

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    if (map.restaurant.position) {
      out.push({
        id: 'restaurant',
        lat: map.restaurant.position.latitude,
        lng: map.restaurant.position.longitude,
        label: map.restaurant.name,
        kind: 'restaurant',
        popupHtml: `<b>${escapeHtml(map.restaurant.name)}</b><br/>ponto de coleta`,
      });
    }
    for (const o of map.orders) {
      if (o.destination) {
        out.push({
          id: o.id,
          lat: o.destination.latitude,
          lng: o.destination.longitude,
          label: `#${o.orderNumber}`,
          kind: 'order',
          late: o.late,
          color: colorFor(o.status, o.dispatchState, o.late),
          onClick: () => setFocusId(o.id),
          popupHtml: `<b>Pedido #${o.orderNumber ?? '—'}</b><br/>${escapeHtml(o.customerName)}<br/>${escapeHtml(o.region ?? '')}<br/>${ORDER_STATUS_LABELS[o.status]}${o.etaMin ? ` · ETA ${o.etaMin}–${o.etaMax} min` : ''}`,
        });
      }
      if (o.driverPosition) {
        out.push({
          id: `${o.id}-driver`,
          lat: o.driverPosition.latitude,
          lng: o.driverPosition.longitude,
          label: o.driverFirstName ?? 'Entregador',
          kind: 'driver',
          popupHtml: `<b>${escapeHtml(o.driverFirstName ?? 'Entregador')}</b><br/>entrega #${o.orderNumber ?? '—'}`,
        });
      }
    }
    return out;
  }, [map]);

  const c = situation.counters;
  const searching = map.counts.searching;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Visão geral</h1>
          <div className="sub">Central de operações{clock ? ` — ${clock}` : ''}</div>
        </div>
        <Link href="/mapa" className="btn sm">
          Abrir mapa completo
        </Link>
      </div>

      <section className={`op-alert ${situation.level}`} style={{ alignItems: 'flex-start' }}>
        <div style={{ fontSize: 20 }}>{situation.emoji}</div>
        <div>
          <div style={{ fontWeight: 700 }}>{situation.headline}</div>
          {situation.lines.map((l, i) => (
            <div key={i} style={{ marginTop: 2 }}>{l}</div>
          ))}
          {situation.action && <div style={{ marginTop: 6, fontWeight: 600 }}>{situation.action}</div>}
        </div>
      </section>

      <section className="stat-row" style={{ margin: '14px 0' }}>
        <Link href="/pedidos" className="stat">
          <div className="v">{c.total}</div>
          <div className="l">pedidos ativos</div>
        </Link>
        <div className="stat">
          <div className="v">{map.counts.inRoute}</div>
          <div className="l">em entrega</div>
        </div>
        <div className={`stat ${searching > 0 ? 'warn' : ''}`}>
          <div className="v">{searching}</div>
          <div className="l">buscando entregador</div>
        </div>
        <div className={`stat ${c.late > 0 ? 'warn' : ''}`}>
          <div className="v">{c.late}</div>
          <div className="l">atrasados</div>
        </div>
        <div className="stat">
          <div className="v">{situation.counters.driversAvailable + situation.counters.driversOnDelivery}</div>
          <div className="l">entregas em execução</div>
        </div>
        <Link href="/financeiro" className="stat">
          <div className="v">{finance.avgCost != null ? formatCurrencyBRL(finance.avgCost) : '—'}</div>
          <div className="l">custo logístico médio (hoje)</div>
        </Link>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 10 }}>
          <LeevaMap
            markers={markers}
            tileUrl={mapConfig.tileUrl}
            attribution={mapConfig.attribution}
            focusId={focusId}
          />
          <div className="map-legend">
            <span><span className="dot" style={{ background: '#8fbcff' }} />Restaurante</span>
            <span><span className="dot" style={{ background: 'var(--warn)' }} />Buscando entregador</span>
            <span><span className="dot" style={{ background: '#8fbcff' }} />A caminho</span>
            <span><span className="dot" style={{ background: 'var(--ok)' }} />Em entrega</span>
            <span><span className="dot" style={{ background: '#ef4444' }} />Atrasado</span>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">Central de alertas</div>
            {alerts.filter((a) => a.severity !== 'ok').length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>Nenhum problema prioritário. 🟢</div>
            ) : (
              alerts
                .filter((a) => a.severity !== 'ok')
                .map((a) => (
                  <div key={a.key} className={`op-alert ${a.severity}`}>
                    <div>
                      <strong>{a.title}</strong>
                      <div style={{ fontSize: 13 }}>{a.message}</div>
                    </div>
                  </div>
                ))
            )}
          </div>

          <div className="card">
            <div className="card-title">Pedidos ({map.orders.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
              {map.orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setFocusId(o.id)}
                  className="op-alert"
                  style={{ textAlign: 'left', cursor: 'pointer', marginBottom: 0, background: 'transparent' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      #{o.orderNumber} · {o.customerName}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {o.region ?? o.destination ? o.region ?? 'destino' : 'sem endereço'} ·{' '}
                      {['searching', 'offered'].includes(o.dispatchState)
                        ? DISPATCH_STATE_LABELS[o.dispatchState as DispatchState]
                        : ORDER_STATUS_LABELS[o.status]}
                      {o.etaMin ? ` · ${o.etaMin}–${o.etaMax} min` : ''}
                    </div>
                  </div>
                  {o.late && <span className="tag red">atrasado</span>}
                </button>
              ))}
              {map.orders.length === 0 && (
                <div className="muted" style={{ fontSize: 13 }}>Nenhum pedido ativo agora.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={() => router.refresh()}
        className="btn sm"
        style={{ marginTop: 12 }}
      >
        Atualizar
      </button>
    </>
  );
}

function colorFor(status: string, dispatch: string, late?: boolean) {
  if (late) return '#ef4444';
  if (['searching', 'offered'].includes(dispatch)) return 'var(--warn)';
  if (status === 'in_route' || status === 'picked_up') return 'var(--ok)';
  if (status === 'assigned') return '#8fbcff';
  return '#ff5a1f';
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
