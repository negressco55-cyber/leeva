/**
 * Tipos do domínio Leeva usados no app nativo. Espelham o JSON devolvido
 * pelas rotas /api do painel do motoboy (não importados do @leeva/shared
 * porque o app nativo fica fora do workspace npm do monorepo).
 */

export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export type OrderStatus =
  | 'waiting_dispatch'
  | 'preparing'
  | 'ready'
  | 'assigned'
  | 'picked_up'
  | 'in_route'
  | 'delivered'
  | 'cancelled';

/** Transições que o motoboy dispara. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  assigned: 'picked_up',
  picked_up: 'in_route',
  in_route: 'delivered',
};

export interface MotoboyMe {
  motoboyId: string;
  fullName: string;
  phone: string | null;
  status: 'offline' | 'available' | 'on_delivery';
  approvalStatus: ApprovalStatus;
  approvalReason: string | null;
  rating: number | null;
  deliveriesCompleted: number;
  deliveriesTotal: number;
  pixKey: string | null;
  pixKeyType: string | null;
  city: string | null;
  pushEnabled: boolean;
  terms: { version: number; content: string } | null;
}

export interface OfferStop {
  seq: number;
  address: string;
  region: string | null;
  payout: number;
}

export interface Offer {
  offerId: string;
  orderId: string;
  orderNumber: number | null;
  customerName: string;
  address: string;
  region: string | null;
  expiresAt: string;
  payout: number | null;
  quality: 'excellent' | 'good' | 'acceptable' | 'poor' | null;
  countsForAcceptance: boolean;
  distancePickupKm: number | null;
  distanceTotalKm: number | null;
  paymentMethod: string;
  paymentStatus: string;
  orderAmount: number;
  notes: string | null;
  grouped: boolean;
  routeStops: OfferStop[] | null;
  routeTotalKm: number | null;
}

export interface Delivery {
  id: string;
  orderNumber: number | null;
  status: OrderStatus;
  customerName: string;
  customerPhone: string | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  pickupName: string;
  pickupAddress: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  payout: number | null;
  orderAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  etaMin: number | null;
  etaMax: number | null;
  groupId: string | null;
  groupSequence: number | null;
}

export interface HistoricoItem {
  id: string;
  orderNumber: number | null;
  status: 'delivered' | 'cancelled';
  customerName: string;
  address: string;
  payout: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface HistoricoResponse {
  items: HistoricoItem[];
  deliveredCount: number;
  totalEarned: number;
}

export interface Performance {
  reliabilityIndex: number;
  acceptanceRate: number | null;
  completionRate: number | null;
  onTimeRate: number | null;
  rating: number | null;
}
