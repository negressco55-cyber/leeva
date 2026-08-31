import { requireRestaurantContext, adminDb } from '@/lib/context';
import {
  evaluateAlerts,
  getSituation,
  getMapData,
  mapClientConfig,
  getLogisticsFinance,
} from '@leeva/shared/services';
import OpsCenter from './OpsCenter';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const ctx = await requireRestaurantContext();
  const db = adminDb();

  const [situation, alertsResult, mapData, finance] = await Promise.all([
    getSituation(db, ctx.restaurantId),
    evaluateAlerts(db, ctx.restaurantId),
    getMapData(db, ctx.restaurantId),
    getLogisticsFinance(db, ctx.restaurantId, 'today'),
  ]);

  return (
    <OpsCenter
      restaurantId={ctx.restaurantId}
      initialSituation={situation}
      initialAlerts={alertsResult.active}
      initialMap={JSON.parse(JSON.stringify(mapData))}
      mapConfig={mapClientConfig()}
      finance={{
        deliveries: finance.deliveries,
        cost: finance.driverCost,
        margin: finance.margin,
        avgCost: finance.avgCost,
      }}
    />
  );
}
