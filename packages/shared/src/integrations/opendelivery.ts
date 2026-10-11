/**
 * Open Delivery (padrão aberto da Abrasel) — lado LOGÍSTICA.
 *
 * Cardápios/PDVs que falam Open Delivery (Cardápio Web, Saipos e outros)
 * pedem um entregador com `POST /v1/logistics/delivery`. O Leeva recebe,
 * converte pro formato da API de entrada (`WebsiteOrderProvider`) e o resto
 * do fluxo é o mesmo de qualquer pedido.
 *
 * Só mapeamento puro aqui (testável); as rotas ficam em
 * apps/restaurante/app/api/opendelivery/**.
 */
import type { Database } from '../types/database';

type OrderStatus = Database['public']['Enums']['order_status'];

type OdMoney = { value?: number | string; currency?: string } | number | string | null | undefined;
type OdAddress = {
  formattedAddress?: string;
  street?: string;
  number?: string;
  complement?: string;
  reference?: string;
  district?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number | string;
  longitude?: number | string;
  coordinates?: { latitude?: number | string; longitude?: number | string };
  instructions?: string;
};

export type OpenDeliveryRequest = {
  orderId?: string;
  orderDisplayId?: string;
  customerName?: string;
  customerPhone?: string;
  customer?: { name?: string; phone?: string | { number?: string } };
  deliveryAddress?: OdAddress;
  totalOrderPrice?: OdMoney;
  orderDeliveryFee?: OdMoney;
  specialInstructions?: string;
  payments?: {
    method?: string; // ONLINE | OFFLINE
    wirelessPos?: boolean; // levar maquininha
    offlineMethod?: { type?: string; value?: OdMoney; changeFor?: OdMoney }[] | string;
    changeFor?: OdMoney;
  };
  limitTimes?: { orderCreatedAt?: string };
};

function money(v: OdMoney): number | null {
  if (v == null) return null;
  const raw = typeof v === 'object' ? v.value : v;
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function num(v: number | string | undefined): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Converte o pedido de entrega Open Delivery no corpo "plano" da API do Leeva. */
export function openDeliveryToFlat(body: OpenDeliveryRequest): Record<string, unknown> {
  const a = body.deliveryAddress ?? {};
  const district = a.district ?? a.neighborhood;
  const line =
    a.formattedAddress?.trim() ||
    [[a.street, a.number].filter(Boolean).join(', '), district, a.city, a.state].filter(Boolean).join(', ');
  const address = a.complement ? `${line} (${a.complement})` : line;

  const phoneObj = body.customer?.phone;
  const phone = body.customerPhone ?? (typeof phoneObj === 'string' ? phoneObj : phoneObj?.number) ?? null;

  const pay = body.payments ?? {};
  const offline = String(pay.method ?? '').toUpperCase() === 'OFFLINE';
  const offlineType = Array.isArray(pay.offlineMethod)
    ? String(pay.offlineMethod[0]?.type ?? '')
    : String(pay.offlineMethod ?? '');
  const changeFor =
    money(pay.changeFor) ?? (Array.isArray(pay.offlineMethod) ? money(pay.offlineMethod[0]?.changeFor) : null);

  let payment_method = 'online';
  if (offline) {
    if (/PIX/i.test(offlineType)) payment_method = 'pix';
    else if (pay.wirelessPos || /CARD|CREDIT|DEBIT|MEAL|FOOD|VOUCHER/i.test(offlineType)) payment_method = 'card_on_delivery';
    else payment_method = 'cash';
  }

  const total = money(body.totalOrderPrice);
  const fee = money(body.orderDeliveryFee);
  const notes = [
    body.orderDisplayId ? `Pedido #${body.orderDisplayId}` : null,
    body.specialInstructions,
    a.instructions,
    a.reference ? `Ref.: ${a.reference}` : null,
    changeFor ? `Troco para R$ ${changeFor.toFixed(2).replace('.', ',')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const lat = num(a.latitude) ?? num(a.coordinates?.latitude);
  const lng = num(a.longitude) ?? num(a.coordinates?.longitude);

  return {
    external_order_id: body.orderId ?? body.orderDisplayId,
    customer_name: body.customerName ?? body.customer?.name,
    customer_phone: phone,
    address,
    latitude: lat,
    longitude: lng,
    region: district ?? undefined,
    payment_method,
    payment_status: offline ? 'pending' : 'paid',
    order_value: total ?? undefined,
    delivery_fee: fee ?? undefined,
    notes: notes || undefined,
    created_at: body.limitTimes?.orderCreatedAt,
  };
}

/** Status do Leeva → evento Open Delivery da entrega. */
export function openDeliveryEvent(status: OrderStatus): string {
  switch (status) {
    case 'assigned':
      return 'ACCEPTED';
    case 'picked_up':
      return 'ORDER_PICKED';
    case 'in_route':
      return 'DELIVERY_ONGOING';
    case 'delivered':
      return 'ORDER_DELIVERED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}
