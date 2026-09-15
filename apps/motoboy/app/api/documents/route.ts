import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { getDriverDocsStatus, saveDriverDocument, type DriverDocType } from '@leeva/shared/services';

/** Limite defensivo do arquivo (base64) — ~5 MB. */
const MAX_B64 = 5 * 1024 * 1024;
const TYPES: DriverDocType[] = ['personal', 'personal_back', 'vehicle', 'avatar'];

/** Estado atual dos documentos do motoboy logado — CNH/RG, CRLV, foto do rosto. */
export async function GET(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const status = await getDriverDocsStatus(adminDb(), ctx.motoboyId);
    return json(status);
  } catch (e) {
    return serverError(e);
  }
}

/**
 * Envia/substitui um documento.
 * body: { type: 'personal' | 'vehicle' | 'avatar', fileBase64: 'data:<mime>;base64,...' }
 */
export async function POST(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const body = (await req.json().catch(() => ({}))) as { type?: string; fileBase64?: string };
    if (!body.type || !TYPES.includes(body.type as DriverDocType)) {
      return badRequest('tipo inválido (personal | vehicle | avatar)');
    }
    if (!body.fileBase64) return badRequest('arquivo obrigatório');
    if (body.fileBase64.length > MAX_B64) return badRequest('arquivo muito grande');

    const m = /^data:(image\/(?:jpe?g|png|webp)|application\/pdf);base64,(.+)$/i.exec(body.fileBase64);
    if (!m) return badRequest('formato de arquivo inválido');
    const mime = m[1]!.toLowerCase();
    const ext = mime === 'application/pdf' ? 'pdf' : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const bytes = Buffer.from(m[2]!, 'base64');

    const r = await saveDriverDocument(adminDb(), ctx.motoboyId, body.type as DriverDocType, bytes, mime, ext);
    if (!r.ok) return serverError(r.error);

    const status = await getDriverDocsStatus(adminDb(), ctx.motoboyId);
    return json({ ok: true, requiresReview: r.requiresReview, ...status });
  } catch (e) {
    return serverError(e);
  }
}
