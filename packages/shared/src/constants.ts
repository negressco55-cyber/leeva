import type {
  OrderStatus,
  MotoboyStatus,
  UserRole,
  OrderSource,
  AlertSeverity,
  IntegrationStatus,
  DispatchState,
  PaymentMethod,
  PaymentStatus,
  FleetMode,
} from './types/index';

/** Ordem natural do fluxo de um pedido. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'waiting_dispatch',
  'preparing',
  'ready',
  'assigned',
  'picked_up',
  'in_route',
  'delivered',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  waiting_dispatch: 'Aguardando despacho',
  preparing: 'Em preparo',
  ready: 'Pronto',
  assigned: 'Atribuído',
  picked_up: 'Coletado',
  in_route: 'Em rota',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

/** Estágios "abertos" (operação ativa) vs finalizados. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  'waiting_dispatch',
  'preparing',
  'ready',
  'assigned',
  'picked_up',
  'in_route',
];
export const CLOSED_ORDER_STATUSES: OrderStatus[] = ['delivered', 'cancelled'];

export const MOTOBOY_STATUS_LABELS: Record<MotoboyStatus, string> = {
  offline: 'Offline',
  available: 'Disponível',
  on_delivery: 'Em entrega',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  restaurant_owner: 'Dono do restaurante',
  restaurant_staff: 'Atendente',
  motoboy: 'Motoboy',
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  manual: 'Manual',
  ifood: 'iFood',
  whatsapp: 'WhatsApp',
  menu: 'Cardápio',
  api: 'API',
};

/**
 * Como o restaurante enxerga o despacho — mensagens operacionais, NUNCA
 * nome/lista de motoboy da rede.
 */
export const DISPATCH_STATE_LABELS: Record<DispatchState, string> = {
  none: 'Aguardando',
  searching: 'Buscando entregador…',
  offered: 'Oferta enviada',
  assigned: 'Entregador encontrado',
  failed: 'Sem entregador disponível',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  card_on_delivery: 'Cartão na entrega',
  online: 'Online',
  pix: 'Pix',
  other: 'Outro',
  unknown: 'Não informado',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'A pagar na entrega',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Estornado',
};

export const FLEET_MODE_LABELS: Record<FleetMode, string> = {
  own: 'Frota própria',
  leeva: 'Rede Leeva',
  hybrid: 'Frota própria + Rede Leeva',
};

/** true quando o pagamento da venda ainda será recebido na entrega. */
export function paymentPendingOnDelivery(method: PaymentMethod, status: PaymentStatus): boolean {
  return status !== 'paid' && (method === 'cash' || method === 'card_on_delivery' || method === 'unknown');
}

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  implemented: 'Implementado',
  prepared: 'Preparado (falta credencial)',
  mock: 'Mock (só desenvolvimento)',
  disabled: 'Desativado',
};

export const ALERT_SEVERITY_META: Record<
  AlertSeverity,
  { label: string; emoji: string }
> = {
  ok: { label: 'Operação normal', emoji: '🟢' },
  info: { label: 'Informação', emoji: '🔵' },
  warning: { label: 'Atenção', emoji: '🟡' },
  critical: { label: 'Crítico', emoji: '🔴' },
};

/** Transições permitidas na máquina de estados do pedido. */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  waiting_dispatch: ['preparing', 'ready', 'assigned', 'cancelled'],
  preparing: ['ready', 'assigned', 'cancelled'],
  ready: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'ready', 'cancelled'],
  picked_up: ['in_route', 'cancelled'],
  in_route: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Próximo status "natural" no fluxo feliz (para os botões grandes do motoboy). */
export function nextOrderStatus(current: OrderStatus): OrderStatus | null {
  const i = ORDER_STATUS_FLOW.indexOf(current);
  if (i < 0 || i >= ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[i + 1] ?? null;
}

/** Tempo-alvo (minutos) por etapa — usado para detectar atraso. Configurável no futuro. */
export const STAGE_SLA_MINUTES = {
  prep: 25, // criação -> pronto
  dispatch: 8, // pronto -> atribuído
  pickup: 12, // atribuído -> coletado
  route: 30, // coletado -> entregue
  total: 55, // criação -> entregue
};
