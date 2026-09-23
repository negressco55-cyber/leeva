import { requireRestaurantContext, adminDb } from '@/lib/context';
import { listKnownDrivers } from '@leeva/shared/services';
import { EntregadoresClient } from './EntregadoresClient';

export const dynamic = 'force-dynamic';

export default async function EntregadoresPage() {
  const ctx = await requireRestaurantContext();
  const drivers = await listKnownDrivers(adminDb(), ctx.restaurantId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Entregadores</h1>
          <div className="sub">Motoboys que já entregaram por você</div>
        </div>
      </div>
      <EntregadoresClient initialDrivers={drivers} />
    </>
  );
}
