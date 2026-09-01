import { getMotoboyContextFromReq, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { getDriverPerformance } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getMotoboyContextFromReq(req);
  if (!ctx) return unauthorized();
  try {
    const perf = await getDriverPerformance(adminDb(), ctx.motoboyId);
    if (!perf) return json({ error: 'não encontrado' }, 404);
    // não expõe fórmula interna — só o essencial + dicas
    return json({
      rating: perf.rating,
      acceptanceRate: Math.round(perf.acceptanceRate),
      completionRate: Math.round(perf.completionRate),
      punctualityRate: Math.round(perf.punctualityRate),
      reliabilityIndex: Math.round(perf.reliabilityIndex),
      explanation: perf.explanation,
      tips: perf.tips,
      blocked: perf.blocked,
      blockedReason: perf.blockedReason,
    });
  } catch (e) {
    return serverError(e);
  }
}
