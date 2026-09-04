/**
 * IFoodOrderProvider — PREPARADO.
 *
 * IMPORTANTE: o iFood não manda webhook pro parceiro. O RECEBIMENTO de
 * pedido de verdade é feito por polling — ver `ifood-client.ts` +
 * `services/ifood-sync.ts` (OAuth client_credentials → GET /events:polling
 * → GET /orders/{id} → parse() abaixo → createOrderFromNormalized).
 * `verifyWebhook` aqui só existe porque a rota genérica
 * `/api/webhooks/[provider]` aceita 'ifood' — não é o caminho usado.
 *
 * O que já está pronto:
 *  - parsing do payload de pedido do iFood (formato da API de Pedidos v1)
 *    para NormalizedOrder;
 *  - pushStatus (confirmar/despachar/concluir), autenticado via
 *    getIfoodAccessToken() (OAuth client_credentials, renova sozinho).
 *
 * O que falta (depende do iFood):
 *  - app aprovado no portal do iFood pro grant `client_credentials` — ver
 *    docs/INTEGRATIONS.md#ifood (testado em sandbox em 02/09, recusado
 *    pelo iFood nesse ponto — não é bug daqui).
 */
import type { OrderProvider, ProviderResult, NormalizedOrder } from './types';
import { hmacSha256Hex, timingSafeEqualHex } from '../lib/crypto';
import { getIfoodAccessToken } from './ifood-client';

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
    return Boolean(process.env.IFOOD_CLIENT_ID && process.env.IFOOD_CLIENT_SECRET);
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
      return { ok: false, error: 'iFood PREPARADO: defina IFOOD_CLIENT_ID/IFOOD_CLIENT_SECRET para enviar status' };
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
      const token = await getIfoodAccessToken();
      const res = await fetch(
        `https://merchant-api.ifood.com.br/order/v1.0/orders/${externalId}/${action}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(8000),
        },
      );
      return res.ok ? { ok: true } : { ok: false, error: `iFood ${res.status}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
