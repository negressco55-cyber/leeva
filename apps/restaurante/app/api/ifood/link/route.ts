import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, forbidden, serverError } from '@/lib/api';
import {
  getIfoodLinkStatus,
  startIfoodLink,
  completeIfoodLink,
  unlinkIfood,
} from '@leeva/shared/services';

/** Estado atual do vínculo do restaurante com o iFood. */
export async function GET() {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  try {
    const status = await getIfoodLinkStatus(adminDb(), ctx.restaurantId);
    return json(status);
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Ações do vínculo:
 *  action=start    → gera o userCode + link do Portal do Parceiro
 *  action=complete → tenta trocar por access/refresh token (depois que o
 *                    dono autorizou no Portal)
 *  action=unlink   → desvincula
 */
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'restaurant_owner') return forbidden('Apenas o dono pode gerenciar integrações.');

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const db = adminDb();

  try {
    if (body.action === 'start') {
      const status = await startIfoodLink(db, ctx.restaurantId);
      return json(status);
    }
    if (body.action === 'complete') {
      const status = await completeIfoodLink(db, ctx.restaurantId);
      return json(status);
    }
    if (body.action === 'unlink') {
      await unlinkIfood(db, ctx.restaurantId);
      return json({ ok: true });
    }
    return json({ error: 'action inválida (start | complete | unlink)' }, 400);
  } catch (e) {
    return serverError(e);
  }
}
