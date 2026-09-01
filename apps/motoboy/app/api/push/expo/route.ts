import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { saveExpoPushToken } from '@leeva/shared/services';

/** body: { token: "ExponentPushToken[...]" } — app nativo (Expo). */
export async function POST(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as { token?: string } | null;
    if (!body?.token) return badRequest('token obrigatório');
    const r = await saveExpoPushToken(adminDb(), ctx.motoboyId, body.token);
    return r.ok ? json({ ok: true }) : badRequest(r.error);
  } catch (e) {
    return serverError(e);
  }
}
