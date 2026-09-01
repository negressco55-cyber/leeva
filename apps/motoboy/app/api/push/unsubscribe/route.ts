import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { deletePushSubscription } from '@leeva/shared/services';

/** body: { endpoint } */
export async function POST(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
    if (!body?.endpoint) return badRequest('endpoint obrigatório');
    await deletePushSubscription(adminDb(), ctx.motoboyId, body.endpoint);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
