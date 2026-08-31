# Arquitetura — Leeva (Fase 2)

## Visão

```
FONTES DE PEDIDO            NÚCLEO LEEVA                        SAÍDAS
─────────────────          ──────────────────────────          ──────────────
manual / cardápio  ─┐      ┌─ OrderService                     ┌─ Realtime (painel/app)
iFood (webhook)     ├─►ADAPTER►─ NormalizedOrder ─►ORDER──►────┤─ Rastreamento público
WhatsApp (webhook)  ─┘      ├─ DispatchService (recommendDriver) │─ NotificationService
API própria         ─┘      ├─ RoutingService (estimativa/OSRM)  │   (in-app | WhatsApp |
                            ├─ GroupingService                   │    SMS | push)
DELIVERY LIFECYCLE          ├─ ETAService                        └─ Analytics / Alerts
(app do motoboy)   ────────►├─ Event system (order_events)
                            └─ AlertService / SituationService
```

## Camadas

| Camada | Onde | Responsabilidade |
|---|---|---|
| **UI** | `apps/restaurante`, `apps/motoboy` (`app/**`) | Componentes React. **Sem regra de negócio** — só chamam rotas de API ou serviços. |
| **API / rotas** | `apps/*/app/api/**/route.ts` | Autenticação, autorização (contexto + escopo por restaurante), validação de input, chamada aos serviços. |
| **Serviços / casos de uso** | `packages/shared/src/services/**` | Regra de negócio. Recebem `SupabaseClient<Database>` por parâmetro (injeção de dependência) → testáveis e agnósticos de ambiente. |
| **Integrações** | `packages/shared/src/integrations/**` | Adapters de fonte de pedido (interface `OrderProvider`), camada de IA do WhatsApp, registry. |
| **Dados** | `supabase/migrations/**` | Schema, índices, triggers, RLS, Realtime. |

### Regra de ouro
Componente visual **nunca** fala com o banco direto para escrever nem contém
lógica de decisão. Ele chama `/api/...` que chama um serviço.

## Módulos (`@leeva/shared`)

```
src/
├── types/            database.ts (GERADO) + index.ts (aliases de domínio)
├── constants.ts      labels, máquina de estados (ALLOWED_ORDER_TRANSITIONS), SLAs
├── supabase/         client (browser) | server + admin | middleware | config
├── hooks/            useRealtimeOrders | useRealtimeMotoboys
├── lib/crypto.ts     HMAC / SHA-256 / token aleatório (Web Crypto, sem dep)
├── services/
│   ├── geo.ts        haversine, região a partir de endereço
│   ├── routing.ts    RoutingService (StraightLine=impl, OSRM=preparado)
│   ├── dispatch.ts   recommendDriver(orderId) → candidatos pontuados + explicação
│   ├── grouping.ts   suggestGroups(restaurantId) → clusters geográficos
│   ├── eta.ts        estimateOrderEta(orderId) → intervalo (nunca horário exato)
│   ├── events.ts     emitEvent / notifyForStatusChange / timeline
│   ├── notifications.ts  NotificationService + adapters de canal
│   ├── alerts.ts     evaluateAlerts(restaurantId) — regras determinísticas
│   ├── situation.ts  getSituation(restaurantId) — "o que está acontecendo?"
│   ├── analytics.ts  getOverview / getDriverMetrics / getRegionMetrics
│   ├── orders.ts     createOrderFromNormalized / advance / assign / accept / location
│   ├── tracking.ts   ensureTrackingToken / getPublicTrackingSnapshot
│   └── webhooks.ts   processInboundWebhook (verify → log → normalize → create)
└── integrations/
    ├── types.ts      NormalizedOrder, OrderProvider
    ├── manual.ts     ManualOrderProvider          (IMPLEMENTADO)
    ├── website.ts    WebsiteOrderProvider (menu/api) (IMPLEMENTADO)
    ├── ifood.ts      IFoodOrderProvider           (PREPARADO)
    ├── whatsapp.ts   WhatsAppOrderProvider        (PREPARADO)
    ├── ai/whatsapp-parser.ts  LLM (Anthropic) + heurística de fallback
    └── registry.ts   getOrderProvider(source) + integrationsOverview()
```

## Sistema de eventos

- Toda mudança de `orders.status` gera uma linha em `order_events` **via trigger
  no banco** (`emit_order_status_event`, `SECURITY DEFINER`). Fonte única da
  verdade da timeline — sem duplicação.
- Eventos que a aplicação dispara explicitamente (`delivery.accepted`,
  `delivery.nearby`): `emitEvent()` no serviço.
- `notifyForStatusChange()` traduz uma transição em notificação do cliente **sem
  gravar outro evento**.
- Cada evento pode gerar: atualização de status (já feita), notificação (in-app
  sempre + canal externo se configurado), recálculo de ETA, e alimenta analytics.

## Máquina de estados do pedido

`waiting_dispatch → preparing → ready → assigned → picked_up → in_route → delivered`
(e `cancelled` a partir de quase qualquer ponto). Transições permitidas em
`ALLOWED_ORDER_TRANSITIONS` (`packages/shared/src/constants.ts`). `advanceOrderStatus`
**recusa** transições inválidas. O motoboy só pode aplicar `picked_up | in_route | delivered`.

## Multi-tenant

- `restaurant_id` é a chave de isolamento em toda tabela (= "organização").
- **RLS** cobre todo acesso direto do navegador (Realtime, queries client-side).
  Helpers `current_restaurant_id()`, `current_user_role()`, `current_motoboy_id()`
  (`SECURITY DEFINER`, sem recursão).
- As **rotas de API** validam a sessão + o papel + que o recurso pertence ao
  `restaurant_id` do contexto, e então usam o cliente `service_role` para os
  serviços (que já filtram por `restaurant_id`/`order_id`).
- O **rastreamento público** (`/track/[token]`) não tem sessão: usa `service_role`
  só para resolver o token e montar um snapshot enxuto.

## IA

Camada **adicional**, nunca no caminho crítico (custo, status, auth, permissões,
despacho básico, pagamento). Hoje: interpretação de mensagem de WhatsApp
(`parseWhatsAppOrder`) — sempre produz **rascunho** que exige confirmação humana
(`requireConfirmation`). LLM: Anthropic (`claude-haiku-4-5`) quando
`ANTHROPIC_API_KEY` existe; senão heurística regex.

---

## Fase 3 — produto comercial (camadas acrescentadas)

O núcleo da Fase 2 foi **reutilizado**, não reescrito. O que entrou:

```
src/services/
├── autodispatch.ts   scoreCandidatesForOrder / runDispatchTick / acceptOffer /
│                      declineOffer / finalizeLogisticsForOrder  — motor automático
├── payout.ts         computeDriverPayout(config, …)  — remuneração configurável
├── billing.ts        ensureSubscription / recordDeliveryUsage / getUsageSummary /
│                      changePlan / getPlanFeatures  — SaaS
├── map.ts            MapProvider (OSM impl · Mapbox preparado) + mapClientConfig
├── mapdata.ts        getMapData(restaurantId)  — snapshot da central (sem expor a rede)
├── heatmap.ts        getHeatmap(restaurantId, period)  — pontos/regiões/insights reais
└── finance.ts        getLogisticsFinance(restaurantId, period)  — margem + alertas
```

- **Despacho automático:** `runDispatchTick` roda por cron global
  (`/api/cron/dispatch-tick`) e por nudge (`/api/dispatch/tick`, chamado ao abrir a
  central e o mapa). CAS/idempotente — seguro rodando de vários lugares.
  O restaurante **não** escolhe entregador; não há rota para isso.
- **Rede Leeva:** entregadores com `motoboys.restaurant_id IS NULL, fleet='leeva'`,
  invisíveis por RLS. Pool de candidatos = próprios + rede conforme
  `restaurants.fleet_mode` (own / leeva / hybrid).
- **Estado de despacho:** `orders.dispatch_state` (none→searching→offered→assigned·failed),
  ortogonal a `orders.status`.
- **Financeiro:** `orders.logistics_margin` é coluna gerada
  (`leeva_fee − driver_payout`). Receita SaaS, receita de logística, custo do
  entregador e margem são separados.
- **Onboarding** obrigatório (`restaurants.onboarding_completed`) — o layout
  redireciona para `/onboarding` até concluir.
- **Menu:** Visão geral · Pedidos · Mapa · Indicadores · Financeiro · Integrações ·
  Configurações. "Minha equipe" só em `own`/`hybrid`. **Nunca** "Motoboys".

Ver `docs/LOGISTICS.md`, `docs/BILLING.md`, `docs/MAP.md`.

---

## Fase 3.5 — go-live, admin, reputação

### Terceiro app: `apps/admin` (porta 3002)

Painel da plataforma. Auth por `platform_admins` + `is_platform_admin()`,
**validada no backend** (`apps/admin/lib/context.ts` com `service_role`). Cookie
próprio `sb-leeva-admin`. Reutiliza `@leeva/shared` e o design system. Ver
`docs/ADMIN.md`.

### Serviços shared acrescentados

```
src/services/
├── reputation.ts     classifyOfferQuality + computeReliabilityIndex + recordIncident
│                     + getDriverPerformance  — dois eixos: candidato × oferta
├── ratelimit.ts      checkRateLimit(kind, id) — janela deslizante no banco
├── observability.ts  captureError(db, scope, err) — ponto único; Sentry plugável
├── platform.ts       getAdminOverview / getAdminFinance / listRestaurants /
│                     getRestaurantDetail / listDrivers / getNetworkOperation
└── apikeys.ts        resolveApiKey / issueApiKey / listApiKeys / revokeApiKey
```

### Cron real

`dispatchTick(db, {source})` = wrapper de produção sobre `runDispatchTick`:
LEASE com TTL (`acquire_dispatch_lease`), log em `dispatch_runs`, captura de erro.
Agendado por `pg_cron` + `pg_net` → `POST /api/cron/dispatch-tick` (`x-cron-secret`).
Ver `docs/DEPLOY.md §4`.

### Fluxo de reputação (novo caminho, sem tocar no despacho existente)

1. `runDispatchTick` escolhe o melhor candidato (score da Fase 3, inalterado).
2. **antes de ofertar:** `classifyOfferQuality` → grava `quality` +
   `counts_for_acceptance` no `dispatch_attempts`.
3. trigger `track_offer_acceptance` mantém contadores de oferta adequada e
   registra `decline_adequate_offer` só quando `counts_for_acceptance`.
4. `advanceOrderStatus(..., {cancelOrigin})` registra incidente no cancelamento
   pós-aceite; origem ≠ `driver` não penaliza.
5. `computeReliabilityIndex` combina os 5 componentes (pesos configuráveis).

### Segurança acrescentada

- **Rate limiting** (`rate_limit_hits` + `rate_limit_check`) em deliveries,
  tracking, webhooks, geocode, cron.
- **Chaves de API por restaurante** (`api_keys`, hash sha-256) — fim da
  dependência de `LEEVA_API_KEY` global em produção.
- **Isolamento admin**: policies `... admin lê todos` (leitura ampla p/ suporte);
  escrita continua restrita. Entregador `blocked` sai do pool de despacho.
