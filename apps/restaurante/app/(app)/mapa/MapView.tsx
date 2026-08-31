'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ORDER_STATUS_LABELS } from '@leeva/shared';
import type { MapData, HeatmapResult } from '@leeva/shared/services';
import { apiGet } from '../_lib/client';
import LeevaMap, { type MapMarker } from '../_lib/LeevaMap';

type Period = 'today' | '7d' | '30d';

export default function MapView({
  restaurantId,
  initialMap,
  mapConfig,
  heatmapEnabled,
}: {
  restaurantId: string;
  initialMap: MapData;
  mapConfig: { tileUrl: string; attribution: string };
  heatmapEnabled: boolean;
}) {
  void restaurantId;
  const [map, setMap] = useState(initialMap);
  const [mode, setMode] = useState<'ops' | 'heat'>('ops');
  const [period, setPeriod] = useState<Period>('7d');
  const [heat, setHeat] = useState<HeatmapResult | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const refreshOps = useCallback(async () => {
    try {
      setMap(await apiGet<MapData>('/api/map'));
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    if (mode !== 'ops') return;
    const iv = setInterval(refreshOps, 12000);
    return () => clearInterval(iv);
  }, [mode, refreshOps]);

  useEffect(() => {
    if (mode !== 'heat' || !heatmapEnabled) return;
    apiGet<HeatmapResult>(`/api/heatmap?period=${period}`).then(setHeat).catch(() => setHeat(null));
  }, [mode, period, heatmapEnabled]);

  const opsMarkers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    if (map.restaurant.position) {
      out.push({
        id: 'restaurant',
        lat: map.restaurant.position.latitude,
        lng: map.restaurant.position.longitude,
        label: map.restaurant.name,
        kind: 'restaurant',
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
          onClick: () => setFocusId(o.id),
          popupHtml: `<b>#${o.orderNumber}</b> ${o.customerName}<br/>${ORDER_STATUS_LABELS[o.status]}`,
        });
      }
      if (o.driverPosition) {
        out.push({
          id: `${o.id}-d`,
          lat: o.driverPosition.latitude,
          lng: o.driverPosition.longitude,
          label: o.driverFirstName ?? 'Entregador',
          kind: 'driver',
        });
      }
    }
    return out;
  }, [map]);

  const heatMarkers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    if (map.restaurant.position) {
      out.push({
        id: 'restaurant',
        lat: map.restaurant.position.latitude,
        lng: map.restaurant.position.longitude,
        label: map.restaurant.name,
        kind: 'restaurant',
      });
    }
    return out;
  }, [map]);

  const heatPoints = useMemo(
    () => (heat?.points ?? []).map((p) => ({ lat: p.latitude, lng: p.longitude, weight: p.weight })),
    [heat],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mapa</h1>
          <div className="sub">Central de operações</div>
        </div>
        <div className="seg">
          <button className={`seg-btn ${mode === 'ops' ? 'active' : ''}`} onClick={() => setMode('ops')}>
            Operação
          </button>
          {heatmapEnabled && (
            <button className={`seg-btn ${mode === 'heat' ? 'active' : ''}`} onClick={() => setMode('heat')}>
              Mapa de calor
            </button>
          )}
        </div>
      </div>

      {mode === 'heat' && heatmapEnabled && (
        <div className="seg" style={{ marginBottom: 12 }}>
          {(['today', '7d', '30d'] as Period[]).map((p) => (
            <button key={p} className={`seg-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p === 'today' ? 'Hoje' : p === '7d' ? '7 dias' : '30 dias'}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 10 }}>
          <LeevaMap
            className="leaflet-map mapa-full"
            markers={mode === 'ops' ? opsMarkers : heatMarkers}
            heat={mode === 'heat' ? heatPoints : undefined}
            tileUrl={mapConfig.tileUrl}
            attribution={mapConfig.attribution}
            focusId={focusId}
          />
        </div>

        <div>
          {mode === 'ops' ? (
            <div className="card">
              <div className="card-title">Pedidos ativos ({map.orders.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
                {map.orders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setFocusId(o.id)}
                    className="op-alert"
                    style={{ textAlign: 'left', cursor: 'pointer', marginBottom: 0, background: 'transparent' }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>#{o.orderNumber} · {o.customerName}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {o.region ?? '—'} · {ORDER_STATUS_LABELS[o.status]}
                        {o.etaMin ? ` · ${o.etaMin}–${o.etaMax} min` : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="card-title">Concentração por região</div>
                {(heat?.regions ?? []).slice(0, 8).map((r) => (
                  <div key={r.region} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                    <span>{r.region}</span>
                    <span className="muted">{Math.round(r.share * 100)}%</span>
                  </div>
                ))}
                {!heat && <div className="muted" style={{ fontSize: 13 }}>Carregando…</div>}
              </div>
              <div className="card">
                <div className="card-title">Inteligência</div>
                {(heat?.insights ?? []).map((ins, i) => (
                  <div key={i} className={`op-alert ${ins.severity === 'warning' ? 'warning' : ins.severity === 'tip' ? 'info' : 'ok'}`}>
                    <div style={{ fontSize: 13 }}>{ins.icon} {ins.text}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
