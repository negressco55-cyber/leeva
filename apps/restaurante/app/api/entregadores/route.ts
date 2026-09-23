import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { listKnownDrivers, setDriverPref, type DriverPrefKind } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

/** Motoboys que já entregaram por esse restaurante, com favorito/bloqueio atual. */
export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const drivers = await listKnownDrivers(adminDb(), ctx.restaurantId);
    return json({ drivers });
  } catch (e) {
    return serverError(e);
  }
}

/** Marca/desmarca um motoboy como favorito ou bloqueado por este restaurante. */
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { motoboyId?: string; kind?: DriverPrefKind | null };
    if (!body.motoboyId) return badRequest('motoboyId é obrigatório');
    if (body.kind !== 'favorite' && body.kind !== 'blocked' && body.kind !== null) {
      return badRequest('kind deve ser "favorite", "blocked" ou null');
    }
    await setDriverPref(adminDb(), ctx.restaurantId, body.motoboyId, body.kind);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
