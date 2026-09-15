import { getAdminApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError, UUID } from '@/lib/api';
import { DEFAULT_LOGISTICS_CONFIG } from '@leeva/shared/services';
import type { LogisticsConfig } from '@leeva/shared';
import type { Database } from '@leeva/shared/types';

export const dynamic = 'force-dynamic';

const num = (v: unknown, min: number, max: number, dflt: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dflt;
  return Math.min(max, Math.max(min, n));
};

/**
 * Admin ajusta taxa cobrada do cliente / pedido mínimo / frete grátis por
 * restaurante — a única forma de mexer nesses valores desde que saíram da
 * tela de Configurações do restaurante.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminApiContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  if (!UUID.test(id)) return badRequest('id inválido');

  const b = (await req.json().catch(() => ({}))) as {
    customerFee?: number;
    minOrder?: number;
    freeDeliveryMinOrder?: number | null;
  };

  try {
    const db = adminDb();
    const { data: current } = await db.from('restaurants').select('logistics_config').eq('id', id).maybeSingle();
    const existing: LogisticsConfig = { ...DEFAULT_LOGISTICS_CONFIG, ...((current?.logistics_config as object) ?? {}) };

    const logistics: LogisticsConfig = {
      ...existing,
      customer_fee: num(b.customerFee, 0, 100, existing.customer_fee),
      min_order: num(b.minOrder, 0, 100000, existing.min_order),
      free_delivery_min_order:
        b.freeDeliveryMinOrder == null || b.freeDeliveryMinOrder <= 0
          ? null
          : num(b.freeDeliveryMinOrder, 0, 100000, 0),
    };

    const upd: Database['public']['Tables']['restaurants']['Update'] = {
      logistics_config: logistics as unknown as Database['public']['Tables']['restaurants']['Update']['logistics_config'],
    };
    await db.from('restaurants').update(upd).eq('id', id);

    return json({ ok: true, logistics });
  } catch (e) {
    return serverError(e);
  }
}
