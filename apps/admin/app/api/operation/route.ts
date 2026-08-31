import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { getNetworkOperation } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  const sp = new URL(req.url).searchParams;
  try {
    const data = await getNetworkOperation(adminDb(), {
      region: sp.get('region') ?? undefined,
      restaurantId: sp.get('restaurantId') ?? undefined,
      status: sp.get('status') ?? undefined,
    });
    return json(data);
  } catch (e) {
    return serverError(e);
  }
}
