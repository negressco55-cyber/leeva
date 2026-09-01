import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { closePayoutBatches } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

/** Dispara o fechamento manualmente (o cron faz isso 1x/dia). */
export async function POST() {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  try {
    const r = await closePayoutBatches(adminDb());
    return json({ ok: true, ...r });
  } catch (e) {
    return serverError(e);
  }
}
