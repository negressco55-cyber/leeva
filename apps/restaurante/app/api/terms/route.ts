import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { getActiveTerms, acceptRestaurantTerms } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json((await getActiveTerms(adminDb(), 'restaurant')) ?? { version: 0, content: '' });
}

/** body: { version } */
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { version?: number };
  const active = await getActiveTerms(adminDb(), 'restaurant');
  if (!active || b.version !== active.version) return badRequest('versão de termos inválida');
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip');
    const r = await acceptRestaurantTerms(adminDb(), ctx.restaurantId, active.version, ip);
    return r.ok ? json({ ok: true }) : badRequest(r.error ?? 'erro');
  } catch (e) {
    return serverError(e);
  }
}
