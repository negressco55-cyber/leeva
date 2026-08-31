'use client';

import { useEffect, useMemo, useState } from 'react';
import type { NetworkOperation } from '@leeva/shared/services';
import { apiGet } from '../_lib/client';
import LeevaMap, { type MapMarker } from '../_lib/LeevaMap';

export function OperationView({
  initial,
  restaurants,
  regions,
}: {
  initial: NetworkOperation;
  restaurants: { id: string; name: string }[];
  regions: string[];
}) {
  const [data, setData] = useState(initial);
  const [region, setRegion] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const qs = new URLSearchParams();
    if (region) qs.set('region', region);
    if (restaurantId) qs.set('restaurantId', restaurantId);
    if (status) qs.set('status', status);
    const load = () => apiGet<NetworkOperation>(`/api/operation?${qs}`).then(setData).catch(() => {});
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [region, restaurantId, status]);

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    for (const r of data.restaurants)
      out.push({ id: `r-${r.id}`, lat: r.lat, lng: r.lng, label: r.name, kind: 'restaurant' });
    for (const d of data.drivers)
      out.push({ id: `d-${d.id}`, lat: d.lat, lng: d.lng, label: d.name, kind: 'driver' });
    for (const o of data.activeOrders)
      out.push({
        id: `o-${o.id}`,
        lat: o.lat,
        lng: o.lng,
        label: `#${o.orderNumber ?? ''}`,
        kind: 'order',
        late: o.dispatchState === 'failed',
        popupHtml: `#${o.orderNumber ?? ''} · ${o.region ?? ''}<br/>${o.status} / ${o.dispatchState}`,
      });
    return out;
  }, [data]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Operação</h1>
          <div className="sub">Mapa geral da rede Leeva</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="input" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            <option value="">Todos os restaurantes</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Todas as regiões</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Qualquer status</option>
            <option value="waiting_dispatch">Aguardando despacho</option>
            <option value="assigned">Atribuído</option>
            <option value="picked_up">Coletado</option>
            <option value="in_route">Em rota</option>
          </select>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 320px' }}>
        <div className="card" style={{ padding: 10 }}>
          <LeevaMap
            className="leaflet-map"
            markers={markers}
            tileUrl={data.mapConfig.tileUrl}
            attribution={data.mapConfig.attribution}
          />
          <div style={{ display: 'flex', gap: 14, fontSize: 12, marginTop: 8 }} className="muted">
            <span>🔵 restaurante</span>
            <span>🟢 entregador</span>
            <span>🟠 entrega</span>
            <span>🔴 sem entregador</span>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">Concentração de demanda</div>
            {data.regionDemand.slice(0, 12).map((r) => (
              <div key={r.region} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                <span>{r.region}</span>
                <span className="muted">{r.active} ativas{r.noDriver ? ` · ${r.noDriver} s/ entregador` : ''}</span>
              </div>
            ))}
            {data.regionDemand.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Sem demanda ativa.</p>}
          </div>
          {data.gaps.length > 0 && (
            <div className="card">
              <div className="card-title">Áreas com falta de entregadores</div>
              {data.gaps.map((g, i) => (
                <div key={i} className="op-alert warning" style={{ fontSize: 13 }}>{g}</div>
              ))}
            </div>
          )}
          <div className="card">
            <div className="card-title">Rede agora</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {data.restaurants.length} restaurantes · {data.drivers.length} entregadores com posição recente ·{' '}
              {data.activeOrders.length} entregas ativas
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
