/**
 * IFoodOrderProvider — PREPARADO.
 *
 * O que já está pronto:
 *  - parsing do payload de pedido do iFood (formato da API de Pedidos v1)
 *    para NormalizedOrder;
 *  - verificação de webhook por HMAC-SHA256 (header x-ifood-signature)
 *    usando IFOOD_WEBHOOK_SECRET;
 *  - pushStatus (confirmar/despachar/concluir) chamando a API do iFood
 *    com IFOOD_ACCESS_TOKEN.
 *
 * O que falta (depende do iFood):
 *  - credenciais de app aprovadas (client_id / client_secret) e OAuth;
 *  - IFOOD_ACCESS_TOKEN válido (fluxo de refresh não incluído aqui);
 *  - homologação do merchant.
 *
 * Enquanto IFOOD_ACCESS_TOKEN / IFOOD_WEBHOOK_SECRET não existirem, o
 * provider recusa webhooks (verifyWebhook = false) e pushStatus retorna erro
 * explícito. Nada é simulado.
 */
import type { OrderProvider, ProviderResult, NormalizedOrder } from './types';
import { hmacSha256Hex, timingSafeEqualHex } from '../lib/crypto';

type IFoodOrderPayload = {
  id?: string;
  displayId?: string;
  customer?: { name?: string; phone?: { number?: string } };
  items?: { name?: string; quantity?: number; price?: number; unitPrice?: number; observations?: string }[];
  total?: { orderAmount?: number; deliveryFee?: number; subTotal?: number };
  delivery?: {
    deliveryAddress?: {
      formattedAddress?: string;
      coordinates?: { latitude?: number; longitude?: number };
      neighborhood?: string;
    };
  };
  createdAt?: string;
  observations?: string;
};

export class IFoodOrderProvider implements OrderProvider {
  readonly source = 'ifood' as const;
  readonly integrationStatus = 'prepared' as const;

  get configured() {
    return Boolean(process.env.IFOOD_ACCESS_TOKEN);
  }

  async verifyWebhook(req: { headers: Record<string, string>; rawBody: string }): Promise<boolean> {
    const secret = process.env.IFOOD_WEBHOOK_SECRET;
    if (!secret) return false; // PREPARADO: sem segredo, não confiamos em nada
    const sig = req.headers['x-ifood-signature'] || req.headers['x-signature'] || '';
    if (!sig) return false;
    const expected = await hmacSha256Hex(secret, req.rawBody);
    return timingSafeEqualHex(expected, sig);
  }

  async parse(payload: unknown): Promise<ProviderResult> {
    const p = payload as IFoodOrderPayload;
    if (!p || (!p.id && !p.displayId)) return { ok: false, error: 'Payload iFood sem id do pedido' };

    const items = (p.items ?? []).map((i) => ({
      name: i.name ?? 'Item',
      quantity: i.quantity ?? 1,
      unitPrice: i.unitPrice ?? i.price ?? 0,
      notes: i.observations,
    }));
    const addr = p.delivery?.deliveryAddress;

    const order: NormalizedOrder = {
      externalId: p.id ?? p.displayId ?? null,
      source: 'ifood',
      eventId: p.id ?? null,
      customer: {
        name: p.customer?.name ?? 'Cliente iFood',
        phone: p.customer?.phone?.number ?? null,
      },
      items,
      address: {
        formatted: addr?.formattedAddress ?? 'Endereço não informado',
        latitude: addr?.coordinates?.latitude ?? null,
        longitude: addr?.coordinates?.longitude ?? null,
        region: addr?.neighborhood ?? null,
      },
      total: p.total?.subTotal ?? p.total?.orderAmount ?? items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
      deliveryFee: p.total?.deliveryFee ?? 0,
      notes: p.observations ?? null,
      createdAt: p.createdAt,
      raw: payload,
    };
    return { ok: true, order };
  }

  async pushStatus(externalId: string, status: string) {
    if (!this.configured)
      return { ok: false, error: 'iFood PREPARADO: defina IFOOD_ACCESS_TOKEN para enviar status' };
    // mapa Leeva -> iFood
    const map: Record<string, string> = {
      preparing: 'confirm',
      in_route: 'dispatch',
      delivered: 'conclude',
      cancelled: 'requestCancellation',
    };
    const action = map[status];
    if (!action) return { ok: true }; // status sem equivalente no iFood
    try {
      const res = await fetch(
        `https://merchant-api.ifood.com.br/order/v1.0/orders/${externalId}/${action}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.IFOOD_ACCESS_TOKEN}` },
          signal: AbortSignal.timeout(8000),
        },
      );
      return res.ok ? { ok: true } : { ok: false, error: `iFood ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
