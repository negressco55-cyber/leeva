import { getApiContext, adminDb } from '@/lib/context';
import { json, unauthorized, badRequest, serverError, tooManyRequests } from '@/lib/api';
import { parseOrderText } from '@leeva/shared/integrations';
import { checkRateLimit } from '@leeva/shared/services';

/**
 * "Colar pedido": recebe o texto de um pedido copiado de qualquer cardápio
 * (Anota AI, Goomer, WhatsApp…) e devolve os campos da entrega pra
 * preencher o formulário. Não cria nada.
 * POST /api/orders/parse-text  { text }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) return unauthorized();

    let body: { text?: unknown };
    try {
      body = (await req.json()) as { text?: unknown };
    } catch {
      return badRequest('JSON inválido');
    }
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (text.length < 10) return badRequest('cole o texto do pedido');
    if (text.length > 8000) return badRequest('texto muito grande');

    const rl = await checkRateLimit(adminDb(), 'parse-text', ctx.restaurantId);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter);

    return json({ ok: true, draft: await parseOrderText(text) });
  } catch (e) {
    return serverError(e);
  }
}
