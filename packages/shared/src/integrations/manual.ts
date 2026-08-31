/**
 * ManualOrderProvider — pedido criado pela própria equipe do restaurante.
 * IMPLEMENTADO. É a fonte "manual" e também a base para o cardápio próprio.
 */
import type { OrderProvider, ProviderResult, NormalizedOrder } from './types';
import type { PaymentMethod, PaymentStatus } from '../types';

export type ManualOrderInput = {
  customerName: string;
  customerPhone?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  region?: string | null;
  items: { name: string; quantity: number; unitPrice: number; notes?: string }[];
  deliveryFee: number;
  notes?: string | null;
  /** valor total dos itens; se ausente, é calculado a partir dos itens */
  total?: number;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: PaymentStatus | null;
};

export class ManualOrderProvider implements OrderProvider {
  readonly source = 'manual' as const;
  readonly integrationStatus = 'implemented' as const;

  async verifyWebhook() {
    return true; // não há webhook — criação é autenticada pela sessão
  }

  async parse(payload: unknown): Promise<ProviderResult> {
    const input = payload as ManualOrderInput;
    if (!input?.customerName?.trim()) return { ok: false, error: 'Nome do cliente é obrigatório' };
    if (!input?.address?.trim()) return { ok: false, error: 'Endereço é obrigatório' };
    const items = (input.items ?? []).filter((i) => i.name?.trim() && i.quantity > 0);
    const total =
      input.total ?? items.reduce((s, i) => s + i.quantity * (i.unitPrice ?? 0), 0);

    const order: NormalizedOrder = {
      externalId: null,
      source: 'manual',
      customer: { name: input.customerName.trim(), phone: input.customerPhone ?? null },
      items: items.map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity,
        unitPrice: i.unitPrice ?? 0,
        notes: i.notes,
      })),
      address: {
        formatted: input.address.trim(),
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        region: input.region ?? null,
      },
      total,
      deliveryFee: input.deliveryFee ?? 0,
      paymentMethod: input.paymentMethod ?? 'unknown',
      paymentStatus: input.paymentStatus ?? 'pending',
      notes: input.notes ?? null,
    };
    return { ok: true, order };
  }
}
