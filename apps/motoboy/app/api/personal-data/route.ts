import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { setPersonalData } from '@leeva/shared/services';

/** Completa CPF + cidade depois do cadastro rápido — tela "Meus dados". */
export async function POST(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { cpf?: string; city?: string };
    if (!body.cpf || !body.city) return badRequest('CPF e cidade são obrigatórios');
    const r = await setPersonalData(adminDb(), ctx.motoboyId, { cpf: body.cpf, city: body.city });
    if (!r.ok) return badRequest(r.error);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
