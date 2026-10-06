import type { MapData } from '@leeva/shared/services';
import type { LivePosition } from '@leeva/shared/hooks';

/**
 * Aplica um ponto de GPS que chegou ao vivo (Realtime) nos pedidos daquele
 * motoboy. Um motoboy pode levar várias entregas agrupadas — todas andam
 * juntas no mapa.
 */
export function applyDriverPosition(map: MapData, p: LivePosition): MapData {
  let changed = false;
  const orders = map.orders.map((o) => {
    if (o.motoboyId !== p.motoboyId) return o;
    changed = true;
    return { ...o, driverPosition: { latitude: p.latitude, longitude: p.longitude } };
  });
  return changed ? { ...map, orders } : map;
}
