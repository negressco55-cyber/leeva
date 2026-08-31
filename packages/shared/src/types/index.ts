import type { Database } from './database';

export type { Database, Json } from './database';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

// ---------- Enums ----------
export type UserRole = Enums['user_role'];
export type MotoboyStatus = Enums['motoboy_status'];
export type OrderStatus = Enums['order_status'];
export type OrderSource = Enums['order_source'];
export type NotificationChannel = Enums['notification_channel'];
export type NotificationRecipient = Enums['notification_recipient'];
export type NotificationStatus = Enums['notification_status'];
export type AlertType = Enums['alert_type'];
export type AlertSeverity = Enums['alert_severity'];
export type IntegrationProvider = Enums['integration_provider'];
export type IntegrationStatus = Enums['integration_status'];
export type IntegrationEventStatus = Enums['integration_event_status'];
export type PaymentMethod = Enums['payment_method'];
export type PaymentStatus = Enums['payment_status'];
export type FleetMode = Enums['fleet_mode'];
export type DriverFleet = Enums['driver_fleet'];
export type DispatchState = Enums['dispatch_state'];
export type DispatchOutcome = Enums['dispatch_outcome'];
export type SubscriptionStatus = Enums['subscription_status'];
export type BillingEventType = Enums['billing_event_type'];
// Fase 3.5
export type OfferQuality = Enums['offer_quality'];
export type IncidentType = Enums['incident_type'];
export type IncidentOrigin = Enums['incident_origin'];

// ---------- Linhas das tabelas ----------
export type Restaurant = Tables['restaurants']['Row'];
export type AppUser = Tables['users']['Row'];
export type Motoboy = Tables['motoboys']['Row'];
export type Order = Tables['orders']['Row'];
export type OrderInsert = Tables['orders']['Insert'];
export type OrderUpdate = Tables['orders']['Update'];
export type OrderStatusHistory = Tables['order_status_history']['Row'];
export type OrderItem = Tables['order_items']['Row'];
export type OrderItemInsert = Tables['order_items']['Insert'];
export type Customer = Tables['customers']['Row'];
export type CustomerInsert = Tables['customers']['Insert'];
export type DriverLocation = Tables['driver_locations']['Row'];
export type DriverLocationInsert = Tables['driver_locations']['Insert'];
export type OrderEvent = Tables['order_events']['Row'];
export type Notification = Tables['notifications']['Row'];
export type NotificationInsert = Tables['notifications']['Insert'];
export type Alert = Tables['alerts']['Row'];
export type AlertInsert = Tables['alerts']['Insert'];
export type Integration = Tables['integrations']['Row'];
export type IntegrationEvent = Tables['integration_events']['Row'];
export type IntegrationEventInsert = Tables['integration_events']['Insert'];
export type TrackingToken = Tables['tracking_tokens']['Row'];
export type MotoboyInsert = Tables['motoboys']['Insert'];
export type MotoboyUpdate = Tables['motoboys']['Update'];
export type Plan = Tables['plans']['Row'];
export type Subscription = Tables['subscriptions']['Row'];
export type BillingEvent = Tables['billing_events']['Row'];
export type PayoutPolicy = Tables['payout_policies']['Row'];
export type DispatchAttempt = Tables['dispatch_attempts']['Row'];
export type PlatformAdmin = Tables['platform_admins']['Row'];
export type DriverIncident = Tables['driver_incidents']['Row'];
export type DispatchRun = Tables['dispatch_runs']['Row'];

/** Pesos e limiares do índice de confiabilidade (reputation_config.config). */
export type ReputationConfig = {
  weights: { acceptance: number; completion: number; punctuality: number; rating: number; incidents: number };
  acceptance_soft_impact: number;
  incident_penalty: Record<IncidentType, number>;
  incident_window_days: number;
  sla_minutes: number;
  block_threshold: number;
  min_sample: number;
};

/** Configuração de logística guardada em restaurants.logistics_config. */
export type LogisticsConfig = {
  service_radius_km: number;
  customer_fee: number;
  free_delivery_min_order: number | null;
  min_order: number;
  grouping_enabled: boolean;
  auto_dispatch_enabled: boolean;
  offer_timeout_seconds: number;
  max_dispatch_attempts: number;
};

/** Configuração do motor de remuneração (payout_policies.config). */
export type PayoutConfig = {
  base: number;
  per_km: number;
  free_km: number;
  grouped_extra: number;
  peak_bonus: number;
  peak_hours: [number, number][];
  min_payout: number;
};

/** Features de plano (plans.features). */
export type PlanFeatures = {
  auto_dispatch?: boolean;
  map?: boolean;
  tracking?: boolean;
  heatmap?: boolean;
  grouping?: boolean;
  own_fleet?: boolean;
  leeva_network?: boolean;
  api?: boolean;
  finance?: boolean;
  insights?: boolean;
  max_active_orders?: number;
};

// ---------- Tipos compostos usados pela UI ----------
export type OrderWithRelations = Order & {
  order_items?: OrderItem[];
  motoboys?: Pick<Motoboy, 'id' | 'full_name' | 'phone' | 'status'> | null;
  customers?: Pick<Customer, 'id' | 'name' | 'phone'> | null;
};

// ---------- Nomes de eventos de domínio ----------
export const DOMAIN_EVENTS = [
  'order.created',
  'order.confirmed',
  'order.preparing',
  'order.ready',
  'delivery.assigned',
  'delivery.accepted',
  'delivery.picked_up',
  'delivery.started',
  'delivery.nearby',
  'delivery.delivered',
  'delivery.cancelled',
  'delivery.delayed',
] as const;
export type DomainEvent = (typeof DOMAIN_EVENTS)[number];
