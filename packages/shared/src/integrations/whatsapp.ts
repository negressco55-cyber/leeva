/**
 * WhatsAppOrderProvider — PREPARADO.
 *
 * Pronto:
 *  - verificação de webhook da WhatsApp Cloud API (hub.challenge no GET +
 *    HMAC x-hub-signature-256 no POST com WHATSAPP_APP_SECRET);
 *  - extração da mensagem de texto do payload;
 *  - passagem da mensagem pela camada de IA (parseWhatsAppOrder) para virar
 *    um rascunho de NormalizedOrder;
 *  - o rascunho SEMPRE precisa de confirmação humana antes de virar pedido
 *    (a IA não cria pedido irreversível sozinha — ver createOrderFromNormalized
 *    com requireConfirmation).
 *
 * Falta (depende da Meta):
 *  - WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_APP_SECRET,
 *    WHATSAPP_VERIFY_TOKEN;
 *  - número de produção aprovado.
 */
import type { OrderProvider, ProviderResult, NormalizedOrder } from './types';
import { hmacSha256Hex, timingSafeEqualHex } from '../lib/crypto';
import { parseWhatsAppOrder } from './ai/whatsapp-parser';

type WhatsAppWebhook = {
  entry?: {
    changes?: {
      value?: {
        messages?: { from?: string; text?: { body?: string }; id?: string; timestamp?: string }[];
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
      };
    }[];
  }[];
};

export class WhatsAppOrderProvider implements OrderProvider {
  readonly source = 'whatsapp' as const;
  readonly integrationStatus = 'prepared' as const;

  get configured() {
    return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
  }

  /** GET do webhook: valida hub.verify_token e devolve hub.challenge. */
  verifyChallenge(params: URLSearchParams): string | null {
    const token = params.get('hub.verify_token');
    const challenge = params.get('hub.challenge');
    if (token && token === process.env.WHATSAPP_VERIFY_TOKEN) return challenge;
    return null;
  }

  async verifyWebhook(req: { headers: Record<string, string>; rawBody: string }): Promise<boolean> {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) return false;
    const sig = req.headers['x-hub-signature-256'] || '';
    if (!sig) return false;
    const expected = 'sha256=' + (await hmacSha256Hex(secret, req.rawBody));
    return timingSafeEqualHex(expected, sig);
  }

  extractMessage(payload: unknown): { from: string; text: string; name?: string; messageId?: string } | null {
    const p = payload as WhatsAppWebhook;
    const value = p.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg?.text?.body || !msg.from) return null;
    return {
      from: msg.from,
      text: msg.text.body,
      name: value?.contacts?.[0]?.profile?.name,
      messageId: msg.id,
    };
  }

  async parse(payload: unknown): Promise<ProviderResult> {
    const msg = this.extractMessage(payload);
    if (!msg) return { ok: false, error: 'Mensagem de WhatsApp sem texto utilizável' };

    const ai = await parseWhatsAppOrder(msg.text, { customerName: msg.name });
    if (!ai.ok) return { ok: false, error: ai.error, retryable: false };

    const order: NormalizedOrder = {
      externalId: msg.messageId ?? null,
      source: 'whatsapp',
      eventId: msg.messageId ?? null,
      customer: { name: msg.name ?? 'Cliente WhatsApp', phone: msg.from },
      items: ai.draft.items,
      address: { formatted: ai.draft.address ?? 'A confirmar', region: ai.draft.region ?? null },
      total: ai.draft.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
      deliveryFee: 0,
      notes: `[Rascunho IA — confirmar com o cliente] ${ai.draft.rawInterpretation}`,
      raw: payload,
    };
    return { ok: true, order };
  }

  async pushStatus(to: string, status: string) {
    if (!this.configured) return { ok: false, error: 'WhatsApp PREPARADO: defina WHATSAPP_TOKEN/PHONE_ID' };
    const texts: Record<string, string> = {
      preparing: 'Recebemos seu pedido e já estamos preparando. 👨‍🍳',
      in_route: 'Seu pedido saiu para entrega! 🛵',
      delivered: 'Pedido entregue. Bom apetite! 😋',
    };
    const body = texts[status];
    if (!body) return { ok: true };
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
          signal: AbortSignal.timeout(8000),
        },
      );
      return res.ok ? { ok: true } : { ok: false, error: `WhatsApp ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
