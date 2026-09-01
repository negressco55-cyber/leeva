import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { setPixKey, getMotoboyPixInfo } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    return json(await getMotoboyPixInfo(adminDb(), ctx.motoboyId));
  } catch (e) {
    return serverError(e);
  }
}

/** body: { key, type } */
export async function POST(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { key?: string; type?: string };
  if (!b.key || !b.type) return badRequest('informe a chave e o tipo');
  try {
    const r = await setPixKey(adminDb(), ctx.motoboyId, b.key, b.type);
    return r.ok ? json({ ok: true }) : badRequest(r.error ?? 'chave inválida');
  } catch (e) {
    return serverError(e);
  }
}
