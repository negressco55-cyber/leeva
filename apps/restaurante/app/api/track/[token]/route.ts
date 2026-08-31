import { createLeevaAdminClient } from '@leeva/shared/server';
import { getPublicTrackingSnapshot, checkRateLimit, clientIp } from '@leeva/shared/services';

/**
 * Snapshot público de rastreamento. Sem autenticação — o token (48 hex) é a
 * credencial. Usa o cliente admin apenas para ler o necessário e devolve um
 * objeto enxuto (sem ids internos, sem custo, sem telefone). Ver
 * services/tracking.ts.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || !/^[0-9a-f]{16,128}$/i.test(token)) {
    return Response.json({ error: 'Link inválido' }, { status: 404 });
  }
  try {
    const db = createLeevaAdminClient();
    const rl = await checkRateLimit(db, "tracking", clientIp(req));
    if (!rl.allowed) {
      return Response.json(
        { error: 'muitas requisições' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter || 30) } },
      );
    }
    const result = await getPublicTrackingSnapshot(db, token);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.code });
    }
    return Response.json(result.snapshot, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    console.error('[api] /track 500:', (e as Error).message);
    return Response.json({ error: 'erro ao carregar o rastreamento' }, { status: 500 });
  }
}
