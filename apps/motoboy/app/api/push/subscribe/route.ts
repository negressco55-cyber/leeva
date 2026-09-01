import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { savePushSubscription } from '@leeva/shared/services';

/** body: PushSubscription.toJSON() → { endpoint, keys: { p256dh, auth } } */
export async function POST(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as
      | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      | null;
    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return badRequest('subscription inválida');
    }
    const r = await savePushSubscription(adminDb(), ctx.motoboyId, {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
      userAgent: req.headers.get('user-agent'),
    });
    return r.ok ? json({ ok: true }) : badRequest(r.error);
  } catch (e) {
    return serverError(e);
  }
}
