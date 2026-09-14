import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { requestPayout } from '@leeva/shared/services';

/**
 * O motoboy solicita o repasse do que tem disponível — por iniciativa
 * própria, a qualquer momento, limitado a uma solicitação por dia.
 */
export async function POST(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const r = await requestPayout(adminDb(), ctx.motoboyId);
    return json(r, r.ok ? 200 : 422);
  } catch (e) {
    return serverError(e);
  }
}
