# Banco de dados — Leeva

Postgres (Supabase). Migrations em `supabase/migrations/`, aplicadas em ordem.

| Migration | Conteúdo |
|---|---|
| `0001_init` | Fase 1: enums, `restaurants`, `users`, `motoboys`, `orders`, `order_status_history`, triggers, helpers de RLS. |
| `0002_rls` | Fase 1: RLS + políticas por papel. |
| `0003_realtime` | Fase 1: publica `orders`, `motoboys` no Realtime. |
| `0004_fix_status_trigger` | Split do trigger de status (BEFORE milestone / AFTER histórico). |
| `0005_fase2_schema` | **Fase 2:** enums novos; `customers`, `order_items`, `driver_locations`, `order_events`, `notifications`, `alerts`, `integrations`, `integration_events`, `tracking_tokens`; colunas novas em `orders`/`motoboys`; triggers (número do pedido, token de tracking, eventos, sync de localização); `haversine_km()`; `cleanup_driver_locations()`. |
| `0006_fase2_rls` | **Fase 2:** RLS + políticas das tabelas novas; `SECURITY DEFINER` nas funções de trigger; Realtime de `order_events`, `alerts`, `driver_locations`, `notifications`. |
| `0007_restaurant_geo` | `restaurants.latitude/longitude/settings`. |
| `0008_alerts_unique_fix` | Índice único simples `alerts(restaurant_id, key)` (para upsert). |
| `0009_tracking_token_fn_fix` | Token de tracking via `gen_random_uuid()` (evita dependência de `pgcrypto` no `search_path`). |
| `0012_fase3_schema` | **Fase 3:** enums `payment_method`, `payment_status`, `fleet_mode`, `driver_fleet`, `dispatch_state`, `dispatch_outcome`, `subscription_status`, `billing_event_type`; tabelas `plans`, `subscriptions`, `billing_events`, `payout_policies`, `dispatch_attempts`; colunas de logística/pagamento/despacho em `orders` (incl. `logistics_margin` GERADA), frota+métricas em `motoboys` (`restaurant_id` passa a NULLABLE = rede Leeva), `fleet_mode`/`onboarding_completed`/`logistics_config` em `restaurants`; triggers `fill_dispatch_timestamps`, `update_motoboy_metrics`. |
| `0013_fase3_rls` | **Fase 3:** RLS das tabelas novas; `plans` leitura autenticada; `subscriptions`/`billing_events` só o próprio restaurante; `payout_policies` o dono gerencia a própria (não a global); `dispatch_attempts` equipe lê as do restaurante e o motoboy lê as ofertas endereçadas a ele; política de `motoboys` reescrita para esconder a rede (`fleet='own'` + `restaurant_id = current_restaurant_id()`); Realtime de `dispatch_attempts`. |

## Tabelas (Fase 3)

### `plans`
`code` (unique: `start`/`pro`/`business`), `monthly_price`, `per_delivery_price`,
`features` (jsonb — **regras de plano ficam aqui, não no código**), `trial_days`,
`sort_order`, `active`.

### `subscriptions`
`unique(restaurant_id)`, `plan_id`, `status` (`trialing|active|past_due|canceled`),
`current_period_start/end`, `trial_ends_at`, `canceled_at`.

### `billing_events`
`type` (`subscription_fee|delivery_fee|adjustment|credit`), `amount`, `description`,
`period_start/end`, `order_id`. `unique(order_id) where type='delivery_fee'` →
**1 cobrança por entrega concluída**.

### `payout_policies`
`restaurant_id` NULLABLE (NULL = política global "Padrão Leeva"), `name`,
`config` (jsonb: `base`, `per_km`, `free_km`, `grouped_extra`, `peak_bonus`,
`peak_hours`, `min_payout`), `active`. Índice único garante 1 global.

### `dispatch_attempts`
`order_id`, `motoboy_id`, `attempt_number`, `score`, `score_breakdown` (jsonb),
`offered_at`, `expires_at` (default now()+45s), `responded_at`, `outcome`
(`accepted|declined|timeout|cancelled|expired`), `reason`.
`unique(order_id) where responded_at is null` → **1 oferta aberta por pedido**.

### `orders` (colunas Fase 3)
`payment_method`, `payment_status`, `dispatch_state`, `dispatch_attempts` (int),
`route_distance_km`, `route_duration_min`, `customer_fee`, `leeva_fee`,
`driver_payout`, `logistics_margin` (**GERADA** = `coalesce(leeva_fee,0) − coalesce(driver_payout,0)`),
`dispatched_at`, `accepted_at`.

### `motoboys` (colunas Fase 3)
`restaurant_id` agora **NULLABLE** (NULL = entregador da rede Leeva),
`fleet` (`own|leeva`), `rating`, `deliveries_total/completed/late`, `avg_delay_min`.
Métricas atualizadas pelo trigger `update_motoboy_metrics` ao concluir/cancelar.

### `restaurants` (colunas Fase 3)
`fleet_mode` (`own|leeva|hybrid`, default `leeva`), `onboarding_completed`,
`logistics_config` (jsonb: `service_radius_km`, `customer_fee`,
`free_delivery_min_order`, `min_order`, `grouping_enabled`, `auto_dispatch_enabled`,
`offer_timeout_seconds`, `max_dispatch_attempts`, `dispatch_weights`).

## Tabelas (Fase 2)

### `customers`
`restaurant_id`, `name`, `phone`, `address`, `latitude`, `longitude`, `region`,
`orders_count`. Upsert leve por telefone quando um pedido chega.

### `orders` (colunas novas)
`order_number` (sequencial por restaurante, `unique(restaurant_id, order_number)`),
`source` (`manual|ifood|whatsapp|menu|api`), `external_id`
(`unique(restaurant_id, source, external_id)` → **idempotência**), `customer_id`,
`latitude/longitude`, `region`, `confirmed_at`, `group_id` (agrupamento),
`eta_min/eta_max/eta_computed_at`.

### `order_items`
`order_id`, `restaurant_id`, `name`, `quantity`, `unit_price`, `notes`.

### `motoboys` (colunas novas)
`current_latitude/longitude/location_updated_at`, `max_concurrent_deliveries`
(default 3), `vehicle`.

### `driver_locations`
`motoboy_id`, `order_id`, `latitude`, `longitude`, `accuracy`, `speed`,
`recorded_at`. Trigger sincroniza a posição "atual" em `motoboys`.
**Retenção:** `cleanup_driver_locations('24 hours')` — ver `DATA-RETENTION.md`.

### `order_events`
Log de domínio. `type` (`order.created`, `delivery.picked_up`, …), `actor_type`,
`data` (jsonb). Gravado por trigger na mudança de status + pelo serviço para
eventos de aplicação.

### `notifications`
`channel` (`in_app|whatsapp|sms|push`), `recipient_type`, `recipient`, `template`,
`title`, `body`, `data`, `status` (`pending|sent|failed|skipped`), `error`,
`attempts`.

### `alerts`
`type` (`delay|no_driver|demand_spike|normal|long_prep`), `severity`
(`ok|info|warning|critical`), `key` (deduplicação, `unique(restaurant_id, key)`),
`title`, `message`, `data`, `active`, `resolved_at`. `evaluateAlerts()` reconcilia.

### `integrations`
`provider`, `status` (`implemented|prepared|mock|disabled`), `config` (jsonb **sem
segredos**), `credentials_set`, `last_event_at`. `unique(restaurant_id, provider)`.

### `integration_events`
Log de webhooks. `provider`, `direction`, `event_id`
(`unique(provider, event_id)` → **idempotência**), `external_order_id`, `order_id`,
`signature_valid`, `status` (`received|processed|failed|duplicate|ignored`),
`error`, `attempts`, `payload`. Sem segredos no payload/log.

### `tracking_tokens`
`order_id`, `token` (`unique`, 64 hex aleatórios), `expires_at` (2 dias),
`revoked`, `views`, `last_viewed_at`. Criado por trigger no insert do pedido.

## Índices principais
`restaurant_id` + (`status` | `created_at` | `source` | `motoboy_id`) em `orders`;
`motoboy_id, recorded_at` em `driver_locations`; `order_id, created_at` em
`order_events`; `provider, event_id` em `integration_events`; `token` em
`tracking_tokens`.

## RLS
Ligado em todas as tabelas. Padrão: equipe (`restaurant_owner`/`restaurant_staff`)
enxerga tudo do próprio `restaurant_id`; motoboy enxerga só o próprio registro,
as entregas atribuídas a ele, os itens/eventos dessas entregas e a própria
trilha de localização. `tracking_tokens` fica trancado — o acesso público é feito
pela rota `/track` com `service_role` + lookup por token.

## Regenerar os tipos TS
```bash
LEEVA_PROJECT_ID=<ref> npm run db:types
```

---

## Tabelas (Fase 3.5)

| Migration | Conteúdo |
|---|---|
| `0014_fase35_admin_cron` | `platform_admins` + `is_platform_admin()`; `dispatch_runs` (log do motor); `rate_limit_hits` + `rate_limit_check()`; `error_events` (base de monitoramento); `try_lock/release_lock`; `pg_cron`+`pg_net`; `trigger_dispatch_tick()` + `configure_dispatch_cron()` |
| `0015_fase35_reputation` | enums `offer_quality`, `incident_type`, `incident_origin`; colunas de qualidade em `dispatch_attempts` (`quality`, `quality_score`, `counts_for_acceptance`, `payout_estimate`, `distance_*`); `driver_incidents`; métricas de reputação em `motoboys` (`reliability_index`, `acceptance_rate`, `completion_rate_pct`, `punctuality_rate`, `offers_adequate*`, `blocked`); `reputation_config` (linha única); trigger `track_offer_acceptance` |
| `0016_fase35_rls` | RLS das tabelas novas + policies `... admin lê todos` nas tabelas existentes (o admin da plataforma enxerga tudo para suporte); `plans`/`payout_policies`/`reputation_config` graváveis pelo admin |
| `0017_fase35_dispatch_lease` | `dispatch_lock` + `acquire_dispatch_lease(ttl)` / `release_dispatch_lease()` — lease com TTL (advisory lock de sessão não sobrevive entre chamadas PostgREST) |
| `0018_fase35_api_keys` | `api_keys` (hash sha-256, `last4`, `last_used_at`, `revoked_at`) — substitui a `LEEVA_API_KEY` global |

### `platform_admins`
`user_id` (PK, → auth.users), `email`, `name`, `active`. Sem escrita via client.

### `dispatch_runs`
`source`, `started_at`, `finished_at`, `duration_ms`, `offered`, `expired`,
`failed`, `skipped` (lease ocupado), `error`. Observabilidade do cron.

### `driver_incidents`
`motoboy_id`, `order_id`, `restaurant_id`, `type` (enum), `origin`
(`driver|restaurant|customer|system|unknown`), `severity`, `note`.
**Só `origin = 'driver'` pesa no índice de confiabilidade.**

### `reputation_config`
Linha única (`id = 1`). `config` jsonb: `weights`, `incident_penalty`,
`acceptance_soft_impact`, `incident_window_days`, `sla_minutes`,
`block_threshold`, `min_sample`. Editável no Admin.

### `api_keys`
1 hash por chave. `revoked_at` desativa. Resolução na borda por `service_role`
(`resolveApiKey`). Fallback de compat: `integrations.config.api_key_hash`.

### `rate_limit_hits`
`(bucket, window_start)` PK, `count`. `rate_limit_check(bucket, limit, window)`
incrementa e diz se está no limite. Limpeza oportunista de janelas > 1 h.
