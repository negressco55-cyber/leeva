import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { getActiveTerms, acceptTerms } from '@leeva/shared/services';
import { clientIp } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return json((await getActiveTerms(adminDb())) ?? { version: 0, content: '' });
}

/** body: { version } */
export async function POST(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { version?: number };
  const active = await getActiveTerms(adminDb());
  if (!active || b.version !== active.version) return badRequest('versão de termos inválida');
  try {
    const r = await acceptTerms(adminDb(), ctx.motoboyId, active.version, clientIp(req));
    return r.ok ? json({ ok: true }) : badRequest(r.error ?? 'erro');
  } catch (e) {
    return serverError(e);
  }
}
