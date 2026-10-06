'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveOps } from '@leeva/shared/hooks';
import {
  DISPATCH_STATE_LABELS,
  ORDER_STATUS_LABELS,
  formatCurrencyBRL,
  type DispatchState,
} from '@leeva/shared';
import type { Situation, MapData } from '@leeva/shared/services';
import { apiGet, apiPost } from '../_lib/client';
import LeevaMap, { type MapMarker } from '../_lib/LeevaMap';
import { applyDriverPosition } from '../_lib/liveMap';

type Alert = { key: string; severity: string; title: string; message: string };
type MapOrder = MapData['orders'][number];

/**
 * Central de operações: o mapa com TODAS as entregas ativas do
 * estabelecimento e os entregadores andando ao vivo; ao lado, a lista das
 * entregas. Tudo chega pelo Supabase Realtime — o recarregamento periódico
 * é só rede de segurança (e para os atrasos, que dependem do relógio).
 */
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
  const [situation, setSituation] = useState(initialSituation);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [map, setMap] = useState(initialMap);
  const [focusId, setFocusId] = useState<string | null>(null);

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
      /* ignora — próxima mudança ou o intervalo tentam de novo */
    }
  }, []);

  const { connected } = useLiveOps(restaurantId, {
    onDriverPosition: (p) => setMap((prev) => applyDriverPosition(prev, p)),
    onOrdersChange: () => void refresh(),
  });

  useEffect(() => {
    // rede de segurança: 1x por minuto, só com a aba visível
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
    const driversDrawn = new Set<string>();
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
      // um marcador por motoboy, mesmo levando várias entregas agrupadas
      const driverKey = o.motoboyId ?? `${o.id}-driver`;
      if (o.driverPosition && !driversDrawn.has(driverKey)) {
        driversDrawn.add(driverKey);
        const carrying = map.orders
          .filter((x) => x.motoboyId && x.motoboyId === o.motoboyId)
          .map((x) => `#${x.orderNumber ?? '—'}`)
          .join(', ');
        out.push({
          id: `driver-${driverKey}`,
          lat: o.driverPosition.latitude,
          lng: o.driverPosition.longitude,
          label: o.driverFirstName ?? 'Entregador',
          kind: 'driver',
          popupHtml: `<b>${escapeHtml(o.driverFirstName ?? 'Entregador')}</b><br/>${carrying || `entrega #${o.orderNumber ?? '—'}`}`,
        });
      }
    }
    return out;
  }, [map]);

  const groups = useMemo(() => groupOrders(map.orders), [map.orders]);
  const problems = alerts.filter((a) => a.severity !== 'ok');
  const c = situation.counters;

  return (
    <>
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h1>Visão geral</h1>
          <div className="sub">
            <span className={`dot ${connected ? 'ok' : ''}`} /> {connected ? 'Ao vivo' : 'Conectando…'} · <Clock />
          </div>
        </div>
        <div className="ops-chips">
          <Link href="/pedidos" className="ops-chip"><b>{c.total}</b> ativas</Link>
          <span className="ops-chip"><b>{map.counts.inRoute}</b> em rota</span>
          <span className={`ops-chip ${map.counts.searching > 0 ? 'warn' : ''}`}>
            <b>{map.counts.searching}</b> buscando entregador
          </span>
          <span className={`ops-chip ${c.late > 0 ? 'danger' : ''}`}><b>{c.late}</b> atrasadas</span>
          <Link href="/financeiro" className="ops-chip">
            <b>{finance.avgCost != null ? formatCurrencyBRL(finance.avgCost) : '—'}</b> custo médio hoje
          </Link>
        </div>
      </div>

      <div className="ops-layout">
        <div className="ops-map-wrap">
          <LeevaMap
            markers={markers}
            tileUrl={mapConfig.tileUrl}
            attribution={mapConfig.attribution}
            focusId={focusId}
            className="leaflet-map ops-map-full"
          />
          <div className="map-legend">
            <span><span className="dot" style={{ background: '#8fbcff' }} />Restaurante</span>
            <span><span className="dot" style={{ background: 'var(--ok)' }} />Entregador / em rota</span>
            <span><span className="dot" style={{ background: 'var(--warn)' }} />Buscando entregador</span>
            <span><span className="dot" style={{ background: '#ff5a1f' }} />Aguardando</span>
            <span><span className="dot" style={{ background: '#ef4444' }} />Atrasada</span>
          </div>
        </div>

        <aside className="ops-side card">
          {situation.level !== 'ok' && (
            <div className={`op-alert ${situation.level}`} style={{ marginBottom: 8 }}>
              <div>
                <strong>{situation.headline}</strong>
                {situation.action && <div style={{ fontSize: 13 }}>{situation.action}</div>}
              </div>
            </div>
          )}
          {problems.map((a) => (
            <div key={a.key} className={`op-alert ${a.severity}`} style={{ marginBottom: 8 }}>
              <div>
                <strong>{a.title}</strong>
                <div style={{ fontSize: 13 }}>{a.message}</div>
              </div>
            </div>
          ))}

          <div className="card-title">Entregas ({map.orders.length})</div>
          <div className="ops-list">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="ops-group">{g.title} · {g.orders.length}</div>
                {g.orders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setFocusId(o.id)}
                    className={`ops-item ${focusId === o.id ? 'active' : ''}`}
                  >
                    <span className="dot" style={{ background: colorFor(o.status, o.dispatchState, o.late) }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="ops-item-title">#{o.orderNumber} · {o.customerName}</span>
                      <span className="ops-item-sub">
                        {o.region ?? (o.destination ? 'destino no mapa' : 'sem endereço')}
                        {o.driverFirstName ? ` · ${o.driverFirstName}` : ''}
                        {o.etaMin ? ` · ${o.etaMin}–${o.etaMax} min` : ''}
                      </span>
                    </span>
                    {o.late && <span className="tag red">atrasada</span>}
                  </button>
                ))}
              </div>
            ))}
            {map.orders.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>Nenhuma entrega ativa agora.</div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

/** Agrupa as entregas pela etapa, na ordem em que o restaurante age. */
function groupOrders(orders: MapOrder[]) {
  const defs: { key: string; title: string; match: (o: MapOrder) => boolean }[] = [
    { key: 'searching', title: 'Buscando entregador', match: (o) => ['searching', 'offered', 'failed'].includes(o.dispatchState) && !o.motoboyId },
    { key: 'assigned', title: 'Entregador indo buscar', match: (o) => o.status === 'assigned' },
    { key: 'route', title: 'Em rota', match: (o) => o.status === 'picked_up' || o.status === 'in_route' },
    { key: 'waiting', title: 'Aguardando', match: () => true },
  ];
  const used = new Set<string>();
  return defs
    .map((d) => {
      const list = orders.filter((o) => !used.has(o.id) && d.match(o));
      list.forEach((o) => used.add(o.id));
      return { key: d.key, title: d.key === 'searching' ? DISPATCH_STATE_LABELS.searching.replace('…', '') : d.title, orders: list };
    })
    .filter((g) => g.orders.length > 0);
}

/** Relógio isolado: re-renderiza só a si mesmo a cada segundo, não a página/mapa. */
function Clock() {
  const [t, setT] = useState('');
  useEffect(() => {
    setT(new Date().toLocaleTimeString('pt-BR'));
    const i = setInterval(() => setT(new Date().toLocaleTimeString('pt-BR')), 1000);
    return () => clearInterval(i);
  }, []);
  return <span suppressHydrationWarning>{t}</span>;
}

function colorFor(status: string, dispatch: string, late?: boolean) {
  if (late) return '#ef4444';
  if (['searching', 'offered'].includes(dispatch as DispatchState)) return 'var(--warn)';
  if (status === 'in_route' || status === 'picked_up') return 'var(--ok)';
  if (status === 'assigned') return '#8fbcff';
  return '#ff5a1f';
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
