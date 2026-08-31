# Billing — modelo comercial SaaS (Fase 3)

Mensalidade + valor por entrega concluída. As regras de plano ficam em
`plans.features` (jsonb) — **nunca espalhadas pelo código**.

## Tabelas

| Tabela | Papel |
|---|---|
| `plans` | catálogo (`code`, `monthly_price`, `per_delivery_price`, `features`, `trial_days`) |
| `subscriptions` | 1 por restaurante (`unique(restaurant_id)`), `status` trialing/active/past_due/canceled, período corrente |
| `billing_events` | linhas da fatura: `subscription_fee`, `delivery_fee`, `adjustment`, `credit`. `unique(order_id) where type='delivery_fee'` → **1 cobrança por entrega** |

## Planos (seed inicial)

| Código | Mensal | Por entrega | Trial | Destaques |
|---|---:|---:|---:|---|
| `start` | R$ 49,90 | R$ 0,80 | 14 d | despacho automático, mapa, tracking, frota própria, até 30 pedidos ativos |
| `pro` | R$ 99,90 | R$ 0,50 | 14 d | + rede Leeva, heatmap, financeiro, API, até 120 ativos |
| `business` | R$ 199,90 | R$ 0,30 | 14 d | + insights, até 1000 ativos |

Valores e features são editáveis na tabela `plans` sem deploy.

## Fluxo

- **Onboarding** (`POST /api/onboarding`) → `ensureSubscription(restaurantId, planCode)`
  cria a assinatura em `trialing` (trial de N dias) e marca `onboarding_completed`.
- **Entrega concluída** (`advanceOrderStatus` → `delivered`) →
  `recordDeliveryUsage()` grava um `billing_events` de `delivery_fee` (idempotente
  por `order_id`).
- **Uso do período** (`getUsageSummary`) → conta `orders` entregues no período da
  assinatura, calcula `variableFee = deliveries × per_delivery_price` e
  `estimatedTotal = monthlyFee + variableFee`.
- **Troca de plano** (`POST /api/billing` — só o dono) → `changePlan()`.

## Gating de recursos

`getPlanFeatures(restaurantId)` devolve `plans.features`. Usado em:

- `/api/heatmap` → 403 se `!features.heatmap`
- `/mapa` esconde a aba "Mapa de calor" se `!features.heatmap`
- (evolução) limites de `max_active_orders`, API, etc.

## Isolado por organização

RLS: cada restaurante lê só a própria `subscriptions` e os próprios
`billing_events`. Escrita só pelo servidor (`service_role`). Verificado em
`scripts/test-fase3.mjs`.

## O que NÃO está aqui (fora do escopo do MVP)

- Cobrança real (gateway de pagamento, emissão de fatura/NF). Os `billing_events`
  + `estimatedTotal` são a base para plugar um gateway depois.
- Dunning / suspensão automática por `past_due`.
