/**
 * WebsiteOrderProvider — pedidos do cardápio próprio / API de entrada do Leeva.
 *
 * IMPORTANTE (Fase 3): o Leeva recebe apenas os dados LOGÍSTICOS. O pedido
 * comercial continua no canal do restaurante. Itens são opcionais — só
 * entram quando forem úteis à operação.
 *
 * Aceita dois formatos: o "plano" da API de entrega (POST /api/v1/deliveries)
 * e o aninhado do cardápio. Autenticação por `x-leeva-api-key` (feita na rota).
 */
import type { OrderProvider, ProviderResult, NormalizedOrder } from './types';
import type { OrderSource, PaymentMethod, PaymentStatus } from '../types';

type FlatPayload = {
  external_order_id?: string;
  external_id?: string;
  event_id?: string;
  customer_name?: string;
  customer_phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  payment_method?: string;
  payment_status?: string;
  order_value?: number;
  delivery_fee?: number;
  notes?: string;
  items?: { name: string; quantity: number; unit_price?: number; notes?: string }[];
  created_at?: string;
  // formato aninhado (compat)
  customer?: { name?: string; phone?: string };
};

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card_on_delivery', 'online', 'pix', 'other', 'unknown'];
const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];

export class WebsiteOrderProvider implements OrderProvider {
  readonly source: OrderSource;
  readonly integrationStatus = 'implemented' as const;

  constructor(source: OrderSource = 'api') {
    this.source = source;
  }

  async verifyWebhook() {
    return true; // a API key já foi verificada pela rota
  }

  async parse(payload: unknown): Promise<ProviderResult> {
    const p = (payload ?? {}) as FlatPayload;
    const name = p.customer_name ?? p.customer?.name;
    const phone = p.customer_phone ?? p.customer?.phone ?? null;
    const addr = p.address ?? (payload as { address?: { formatted?: string } })?.address?.formatted;
    const nested = payload as {
      address?: { formatted?: string; latitude?: number; longitude?: number; region?: string };
      total?: number;
    };

    if (!name?.trim()) return { ok: false, error: 'customer_name obrigatório' };
    const formatted = (typeof addr === 'string' ? addr : nested.address?.formatted)?.trim();
    if (!formatted) return { ok: false, error: 'address obrigatório' };

    const items = (p.items ?? []).filter((i) => i?.name && i.quantity > 0);

    const method = PAYMENT_METHODS.includes(p.payment_method as PaymentMethod)
      ? (p.payment_method as PaymentMethod)
      : 'unknown';
    const status = PAYMENT_STATUSES.includes(p.payment_status as PaymentStatus)
      ? (p.payment_status as PaymentStatus)
      : 'pending';

    const order: NormalizedOrder = {
      externalId: p.external_order_id ?? p.external_id ?? null,
      source: this.source,
      eventId: p.event_id ?? p.external_order_id ?? p.external_id ?? null,
      customer: { name: name.trim(), phone },
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unit_price ?? 0,
        notes: i.notes,
      })),
      address: {
        formatted,
        latitude: p.latitude ?? nested.address?.latitude ?? null,
        longitude: p.longitude ?? nested.address?.longitude ?? null,
        region: p.region ?? nested.address?.region ?? null,
      },
      total:
        p.order_value ??
        nested.total ??
        items.reduce((s, i) => s + i.quantity * (i.unit_price ?? 0), 0),
      deliveryFee: p.delivery_fee ?? 0,
      paymentMethod: method,
      paymentStatus: status,
      notes: p.notes ?? null,
      createdAt: p.created_at,
      raw: payload,
    };
    return { ok: true, order };
  }
}
