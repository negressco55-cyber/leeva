import type { MapData } from '@leeva/shared/services';
import type { LivePosition } from '@leeva/shared/hooks';

/**
 * Aplica um ponto de GPS que chegou ao vivo (Realtime) nos pedidos daquele
 * motoboy e no painel da equipe. Um motoboy pode levar várias entregas
 * agrupadas — todas andam juntas no mapa. Motoboy da equipe parado (sem
 * entrega) também anda: o ponto chega com order_id nulo.
 */
export function applyDriverPosition(map: MapData, p: LivePosition): MapData {
  let changed = false;
  const pos = { latitude: p.latitude, longitude: p.longitude };
  const orders = map.orders.map((o) => {
    if (o.motoboyId !== p.motoboyId) return o;
    changed = true;
    return { ...o, driverPosition: pos };
  });
  const team = (map.team ?? []).map((d) => {
    if (d.id !== p.motoboyId) return d;
    changed = true;
    return {
      ...d,
      position: pos,
      lastSeenAt: new Date().toISOString(),
      state: d.state === 'offline' ? ('free' as const) : d.state,
    };
  });
  return changed ? { ...map, orders, team } : map;
}
