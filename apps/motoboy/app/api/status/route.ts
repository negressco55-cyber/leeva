import { getMotoboyContext, adminDb } from '@/lib/context';
import { json, unauthorized, businessError, serverError } from '@/lib/api';
import { checkDriverGate } from '@leeva/shared/services';

/** Motoboy fica online (available) / offline. */
export async function POST(req: Request) {
  try {
    const ctx = await getMotoboyContext();
    if (!ctx) return unauthorized();

    const { online } = (await req.json().catch(() => ({}))) as { online?: boolean };
    if (typeof online !== 'boolean') return json({ error: 'online (boolean) obrigatório' }, 400);
    const db = adminDb();

    // aprovação + termos aceitos antes de ficar online
    if (online) {
      const gate = await checkDriverGate(db, ctx.motoboyId);
      if (!gate.ok) return businessError(gate.message);
    }

    // não deixa ficar offline com entrega ativa
    if (!online) {
      const { count } = await db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('motoboy_id', ctx.motoboyId)
        .in('status', ['assigned', 'picked_up', 'in_route']);
      if (count) {
        return businessError('Finalize suas entregas antes de ficar offline.');
      }
    }

    // ao ficar online: só muda se estava offline (não rebaixa 'on_delivery').
    // ao ficar offline: força (o check acima já garantiu que não há entrega ativa).
    let q = db.from('motoboys').update({ status: online ? 'available' : 'offline' }).eq('id', ctx.motoboyId);
    if (online) q = q.eq('status', 'offline');
    const { error } = await q;
    if (error) return serverError(error.message);

    const { data: fresh } = await db
      .from('motoboys')
      .select('status')
      .eq('id', ctx.motoboyId)
      .maybeSingle();
    return json({ ok: true, status: fresh?.status ?? (online ? 'available' : 'offline') });
  } catch (e) {
    return serverError(e);
  }
}
