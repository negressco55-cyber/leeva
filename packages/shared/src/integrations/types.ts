/**
 * Camada de normalização de pedidos.
 *
 *   SOURCE → ADAPTER → NormalizedOrder → LEEVA ORDER → DELIVERY
 *
 * A lógica interna do Leeva NUNCA fala o formato do iFood/WhatsApp.
 * Todo provedor externo entrega um `NormalizedOrder` e o resto do
 * sistema só conhece esse formato.
 */
import type { OrderSource, PaymentMethod, PaymentStatus } from '../types';

export type NormalizedItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
};

export type NormalizedCustomer = {
  name: string;
  phone?: string | null;
};

export type NormalizedAddress = {
  formatted: string;
  latitude?: number | null;
  longitude?: number | null;
  region?: string | null;
};

export type NormalizedOrder = {
  externalId: string | null;
  source: OrderSource;
  eventId?: string | null; // id do evento no provedor (idempotência)
  customer: NormalizedCustomer;
  items: NormalizedItem[];
  address: NormalizedAddress;
  total: number; // valor dos itens
  deliveryFee: number;
  /** Pagamento DA VENDA (o Leeva só registra, não processa). */
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus | null;
  notes?: string | null;
  createdAt?: string; // ISO, quando o provedor informa
  raw?: unknown; // payload original, para auditoria
};

export type ProviderResult =
  | { ok: true; order: NormalizedOrder }
  | { ok: false; error: string; retryable?: boolean };

/** Interface comum a todos os provedores de pedido. */
export interface OrderProvider {
  readonly source: OrderSource;
  /** 'implemented' | 'prepared' | 'mock' */
  readonly integrationStatus: 'implemented' | 'prepared' | 'mock';
  /** Valida a assinatura/autenticidade de um webhook recebido. */
  verifyWebhook(req: { headers: Record<string, string>; rawBody: string }): Promise<boolean>;
  /** Converte um payload cru do provedor em NormalizedOrder. */
  parse(payload: unknown): Promise<ProviderResult>;
  /** Envia uma atualização de status de volta ao provedor (quando aplicável). */
  pushStatus?(externalId: string, status: string): Promise<{ ok: boolean; error?: string }>;
}
