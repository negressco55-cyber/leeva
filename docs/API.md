# API — Leeva

Todas as rotas do painel exigem sessão de `restaurant_owner`/`restaurant_staff` e
só operam sobre o `restaurant_id` do contexto. Rotas do app do motoboy exigem
sessão de `motoboy` ativo. `/track` e os webhooks são públicos (token/assinatura).

## Painel do restaurante (`apps/restaurante`)

| Método | Rota | Body | Retorno |
|---|---|---|---|
| POST | `/api/orders` | `{customerName, customerPhone?, address, region?, latitude?, longitude?, deliveryFee, notes?, items:[{name,quantity,unitPrice}], total?}` | `{ok, orderId, orderNumber}` |
| GET | `/api/orders/:id` | — | `{order, timeline, trackingUrl, notifications}` |
| GET | `/api/orders/:id/recommend` | — | `DispatchRecommendation` (candidatos pontuados + explicação) |
| POST | `/api/orders/:id/dispatch` | `{motoboyId}` ou `{auto:true}` | `{ok, motoboyId}` |
| POST | `/api/orders/:id/status` | `{status}` | `{ok}` (recusa transição inválida) |
| POST | `/api/orders/:id/tracking-link` | — | `{ok, token, url}` |
| GET | `/api/dispatch/groups` | — | `GroupingSuggestion` |
| POST | `/api/alerts/evaluate` | — | `{alerts, situation}` |
| GET | `/api/track/:token` | — (público) | `PublicTrackingSnapshot` |
| POST | `/api/webhooks/:provider` | payload do provedor (`ifood`/`whatsapp`) | `{ok, order_id?, duplicate?}` |
| GET | `/api/webhooks/whatsapp` | `?hub.challenge=...` | challenge (verificação Meta) |
| POST | `/api/integrations/orders` | payload do cardápio (`x-leeva-api-key`) | `{ok, order_id, order_number, duplicate}` |
| POST | `/api/cron/cleanup` | — (`x-cron-secret`) | `{ok, deleted_driver_locations}` |

## App do motoboy (`apps/motoboy`)

| Método | Rota | Body | Retorno |
|---|---|---|---|
| POST | `/api/status` | `{online:boolean}` | `{ok, status}` (bloqueia offline com entrega ativa) |
| POST | `/api/location` | `{latitude, longitude, accuracy?, speed?}` | `{ok, stored}` (só grava com entrega ativa) |
| POST | `/api/deliveries/:id` | `{action:'accept'}` ou `{action:'status', status}` | `{ok}` (só `picked_up\|in_route\|delivered`) |

## Códigos
`400` input inválido · `401` sem sessão · `403` recurso de outro restaurante /
entrega de outro motoboy · `404` não encontrado · `409/422` regra de negócio ·
`200` ok.

---

## Fase 3 — produto comercial

### Restaurante (`apps/restaurante`)

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/map` | dados da central de operações (+ dispara um tick de despacho) |
| GET | `/api/heatmap?period=` | mapa de calor + insights (403 sem plano Pro) |
| GET | `/api/finance?period=` | financeiro da logística + resumo SaaS |
| GET/POST | `/api/billing` | uso/planos · trocar de plano (dono) |
| GET/PUT | `/api/config` | fleet_mode, coords, logistics_config, política de payout (PUT: só o dono; retorna `warnings`) |
| GET | `/api/geocode?q=` | endereço → lat/lng |
| POST | `/api/team` | frota própria: adicionar / (des)ativar entregador (own/hybrid) |
| POST | `/api/onboarding` | conclui o onboarding + assinatura |
| POST | `/api/dispatch/tick` | nudge do motor de despacho para este restaurante |
| POST | `/api/cron/dispatch-tick` | loop global (`x-cron-secret`) — expira ofertas, oferta pendentes, marca falhas |
| POST | `/api/v1/deliveries` | **API de entrada** — sistema do restaurante envia os dados logísticos (`x-leeva-api-key`, idempotente por `external_order_id`) |

`POST /api/v1/deliveries` body: `external_order_id, customer_name, customer_phone,
address, latitude?, longitude?, region?, payment_method?, payment_status?,
order_value?, delivery_fee?, notes?, items?` → `201 { delivery_id, order_number,
status:'accepted', dispatch:'searching_driver' }` ou `200 { status:'existing' }`.

### App do entregador (`apps/motoboy`)

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/offers` | ofertas abertas endereçadas a este entregador |
| POST | `/api/offers/[id]` | `{ action: 'accept' \| 'decline', reason? }` |

O restaurante **não tem** rota para escolher/listar a rede de entregadores.
`/api/orders/[id]/recommend` e `/api/dispatch/groups` (Fase 2) foram removidas —
o despacho é automático.

---

## Fase 3.5 — go-live, admin, reputação

### Novas em `apps/restaurante`

| Método | Rota | Uso |
|---|---|---|
| GET/POST/DELETE | `/api/api-keys` | listar / gerar / revogar chave de API do restaurante (POST/DELETE: só o dono). A chave crua aparece **uma vez**. |
| GET | `/api/performance` | *(app do motoboy)* desempenho do entregador logado (índice, taxas, dicas) — sem revelar a fórmula |

`/api/cron/dispatch-tick` agora usa `dispatchTick` (LEASE + `dispatch_runs`) e
recalcula reputação periodicamente. Rate limit aplicado a
`/api/v1/deliveries`, `/api/integrations/orders`, `/api/track/:token`,
`/api/webhooks/:provider`, `/api/geocode`, `/api/cron/dispatch-tick`
(429 + `Retry-After` quando estoura).

### Painel admin (`apps/admin`, porta 3002)

Todas exigem sessão em `platform_admins` (validada no backend). Ver `docs/ADMIN.md`.

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/operation` | mapa/dados da rede (filtros: região, restaurante, status) |
| POST | `/api/plans` | criar/editar plano (upsert por `code`) |
| GET/POST | `/api/reputation-config` | ler/salvar pesos e limiares do índice |
| POST | `/api/drivers/[id]/block` | bloquear/desbloquear entregador |

As telas (Visão geral, Restaurantes, Entregadores, Financeiro) são renderizadas
no servidor chamando os serviços `getAdminOverview`, `listRestaurants`,
`getRestaurantDetail`, `listDrivers`, `getDriverPerformance`, `getAdminFinance`,
`getNetworkOperation` (`@leeva/shared/services/platform`).
