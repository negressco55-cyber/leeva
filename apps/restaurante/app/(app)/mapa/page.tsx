import { requireRestaurantContext, adminDb } from '@/lib/context';
import { getMapData, mapClientConfig, getPlanFeatures } from '@leeva/shared/services';
import MapView from './MapView';

export const dynamic = 'force-dynamic';

export default async function MapaPage() {
  const ctx = await requireRestaurantContext();
  const db = adminDb();
  const [mapData, features] = await Promise.all([
    getMapData(db, ctx.restaurantId),
    getPlanFeatures(db, ctx.restaurantId),
  ]);

  return (
    <MapView
      restaurantId={ctx.restaurantId}
      initialMap={JSON.parse(JSON.stringify(mapData))}
      mapConfig={mapClientConfig()}
      heatmapEnabled={!!features.heatmap}
    />
  );
}
