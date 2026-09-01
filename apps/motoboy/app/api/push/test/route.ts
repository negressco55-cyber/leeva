import { getMotoboyContext, adminDb } from '@/lib/context';
import { json, unauthorized, serverError } from '@/lib/api';
import { sendPushToMotoboy } from '@leeva/shared/services';

/** Dispara uma notificação de teste para confirmar que chegou no aparelho. */
export async function POST() {
  const ctx = await getMotoboyContext();
  if (!ctx) return unauthorized();
  try {
    const r = await sendPushToMotoboy(adminDb(), ctx.motoboyId, {
      title: 'Notificações ativadas ✅',
      body: 'É assim que você vai receber as ofertas de entrega, mesmo com o app fechado.',
      url: '/status',
      tag: 'test',
    });
    return json(r);
  } catch (e) {
    return serverError(e);
  }
}
