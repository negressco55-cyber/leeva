import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError } from '@/lib/api';
import { DEFAULT_REPUTATION_CONFIG } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  const { data } = await adminDb().from('reputation_config').select('config').eq('id', 1).maybeSingle();
  return json({ config: { ...DEFAULT_REPUTATION_CONFIG, ...((data?.config as object) ?? {}) } });
}

export async function POST(req: Request) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return badRequest('config inválida');

  // valida o formato mínimo
  const cfg = { ...DEFAULT_REPUTATION_CONFIG, ...b };
  if (typeof cfg.weights !== 'object' || typeof cfg.incident_penalty !== 'object')
    return badRequest('weights e incident_penalty são obrigatórios');
  for (const v of Object.values(cfg.weights)) if (typeof v !== 'number' || v < 0) return badRequest('peso inválido');

  try {
    const { error } = await adminDb()
      .from('reputation_config')
      .update({ config: cfg as never, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) return serverError(error);
    return json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
