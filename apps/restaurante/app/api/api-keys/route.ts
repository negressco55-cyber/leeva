import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, badRequest, serverError, UUID } from '@/lib/api';
import { listApiKeys, issueApiKey, revokeApiKey } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    return json({ keys: await listApiKeys(adminDb(), ctx.restaurantId) });
  } catch (e) {
    return serverError(e);
  }
}

/** cria nova chave — só o dono. Retorna a chave em claro UMA vez. */
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'restaurant_owner') return forbidden('só o dono pode gerar chaves de API');
  const b = (await req.json().catch(() => ({}))) as { name?: string };
  try {
    const issued = await issueApiKey(adminDb(), ctx.restaurantId, { name: b.name, createdBy: ctx.userId });
    return json({ ok: true, ...issued });
  } catch (e) {
    return serverError(e);
  }
}

/** revoga uma chave — só o dono. body: { id } */
export async function DELETE(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'restaurant_owner') return forbidden('só o dono pode revogar chaves');
  const b = (await req.json().catch(() => ({}))) as { id?: string };
  if (!b.id || !UUID.test(b.id)) return badRequest('id inválido');
  try {
    const ok = await revokeApiKey(adminDb(), ctx.restaurantId, b.id);
    return ok ? json({ ok: true }) : badRequest('chave não encontrada');
  } catch (e) {
    return serverError(e);
  }
}
