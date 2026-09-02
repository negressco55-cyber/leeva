// Camada de serviços / casos de uso do Leeva.
// Todos recebem um SupabaseClient<Database> por parâmetro (injeção de
// dependência) — não criam cliente próprio, ficam testáveis e agnósticos
// de ambiente.

export * from './geo';
export * from './routing';
export * from './dispatch';
export * from './grouping';
export * from './eta';
export * from './events';
export * from './notifications';
export * from './alerts';
export * from './analytics';
export * from './situation';
export * from './orders';
export * from './tracking';
export * from './webhooks';
// Fase 3 — produto comercial
export * from './autodispatch';
export * from './payout';
export * from './billing';
export * from './map';
export * from './address';
export * from './heatmap';
export * from './finance';
export * from './mapdata';
// Fase 3.5 — go-live, admin, reputação
export * from './reputation';
export * from './ratelimit';
export * from './observability';
export * from './platform';
export * from './apikeys';
export * from './credits';
export * from './asaas';
export * from './driverpayouts';
export * from './drivers';
export * from './push';
export * from './notify-driver';
export * from './grouping-dispatch';
