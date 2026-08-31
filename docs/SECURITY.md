# Segurança e hardening — Leeva

Resultado da auditoria da Fase 2. O que foi verificado, corrigido e testado.

## Modelo de acesso

| Camada | Como protege |
|---|---|
| **RLS (Postgres)** | Todo acesso direto do navegador (Realtime, queries client-side). 14/14 tabelas com RLS. Isolamento por `restaurant_id`; motoboy só vê a si mesmo + entregas atribuídas. Helpers `current_restaurant_id()`, `current_user_role()`, `current_motoboy_id()` são `SECURITY DEFINER` (sem recursão). |
| **Rotas de API** | `getApiContext()` / `getMotoboyContext()` validam sessão + papel via cliente com RLS. Depois usam `service_role` para os serviços, **sempre** após confirmar que o recurso pertence ao `restaurant_id`/`motoboy_id` do contexto (`orderBelongsTo`, checagem de `motoboy_id`). |
| **Rastreamento público** | Sem sessão. Token de 48 hex (192 bits) — inadivinhável. `service_role` só resolve o token e monta um snapshot enxuto. |
| **Webhooks** | Assinatura HMAC obrigatória. Sem o segredo (PREPARADO) todo webhook é recusado (401). Idempotência por `event_id` (ou hash do corpo quando o provedor não manda id). |
| **Cardápio/API** | `x-leeva-api-key` comparada por hash SHA-256. |
| **Cron** | `x-cron-secret`. Sem `CRON_SECRET` definido o endpoint fica **desativado (503)**, nunca aberto. |

## Testes de segurança (`npm run test:security`, 23 checagens)

- RLS: usuário do restaurante B **não lê nem escreve** orders / customers / motoboys / order_events / driver_locations / notifications / tracking_tokens do restaurante A.
- API autenticada: dono de A recebe **403** ao acessar/alterar/despachar pedido de B (GET, status, dispatch, recommend, tracking-link).
- API sem sessão → **401**.
- Tracking: token inválido → 404; expirado/revogado → 410; id do pedido usado como token → 404; **não expõe** telefone, endereço textual, `restaurant_id`, `order_id`, custo.

## Concorrência (`npm run test:concurrency`, 6 checagens)

| Cenário | Proteção |
|---|---|
| 2 despachos simultâneos do mesmo pedido | compare-and-swap em `orders` (`.eq('motoboy_id', lido)` / `.is('motoboy_id', null)`) — só 1 vence, o outro recebe "já foi despachado". |
| 2 transições de status simultâneas | CAS em `.eq('status', lido)` — só 1 vence; se o alvo já é o estado atual, é idempotente (ok). |
| Conclusão duplicada | idempotente — nenhum evento/estado duplicado. |
| Aceite duplicado | índice único parcial `order_events(order_id, type) WHERE type IN ('delivery.accepted','delivery.nearby')` → 1 evento. |
| Capacidade do motoboy | `max_concurrent_deliveries` verificado no despacho. |
| Webhook duplicado | `unique(provider, event_id)` → 1 pedido, 1 log. |

## Integridade de dados (migrations 0010–0011)

- `unique(customers.restaurant_id, phone)` — sem clientes duplicados em corrida; `createOrderFromNormalized` usa upsert.
- CHECK de coordenadas (`-90..90` / `-180..180`) em orders, motoboys, restaurants, driver_locations.
- CHECK de valores monetários `>= 0`.
- Cascades revisadas: apagar restaurante → cascata; apagar motoboy → `orders.motoboy_id` vira NULL (pedido preservado); `driver_locations`/`order_events`/`tracking_tokens` cascateiam com o pedido.
- Verificado: **0 linhas órfãs** em order_items / order_events / tracking_tokens / orders→motoboys.
- Índices adicionados para escala: `orders(motoboy_id, status)`, `orders(restaurant_id, delivered_at)`, `notifications(order_id, template)`.

## Robustez

- **Erros nunca vazam detalhe de banco:** rotas retornam `{error: 'erro interno — tente novamente'}` (500) e logam o detalhe no servidor. Erros de regra de negócio (transição inválida, sem motoboy) retornam **422** com mensagem clara e segura.
- **Falha de notificação não quebra a entrega:** todas as chamadas de notificação/ETA em `advanceOrderStatus`/`assignDriver`/`emitEvent` estão em try/catch.
- **ETA nunca inventa precisão:** coordenada absurda / GPS velho (> 10 min) / rota impossível → devolve `null` ("sem previsão") ou trava o intervalo em ≤ 180 min. Sempre intervalo, nunca horário exato.
- **Localização:** só grava com entrega ativa; coordenada validada; retenção de 24 h (`cleanup_driver_locations`).
- **Validação de entrada:** limites de tamanho em nome/endereço/itens (100 itens máx), corpo de webhook (256 KB), API de cardápio (128 KB), valores monetários (teto 1 M).
- **Performance:** indicadores fazem **1 leitura** do conjunto de pedidos (antes eram 3) com teto de 20 000 linhas (acima disso a UI avisa "amostra"). `evaluateAlerts` tem throttle de 12 s por restaurante (vários painéis abertos não multiplicam a carga) e faz upsert em lote. Alertas de atraso (transitórios) são apagados ao resolver — a tabela não cresce sem limite.

## Segredos

- `.env.local` no `.gitignore`. Nenhum segredo hardcoded no código (verificado por scan).
- Segredos nunca vão para logs (`integration_events.payload` guarda o corpo do webhook, **não** os headers de autenticação).
- Frontend só recebe `NEXT_PUBLIC_*` (URL + anon key do Supabase — projetadas para o navegador).

## Riscos residuais

| Nível | Item |
|---|---|
| **MÉDIO** | Webhook multi-tenant usa um único `IFOOD_WEBHOOK_SECRET` / `WHATSAPP_APP_SECRET` por deployment. Numa operação real com muitos restaurantes no iFood, cada um teria credencial própria — a arquitetura suporta (`integrations` por restaurante), mas o mapeamento secret↔restaurante ainda é por `?restaurant=<id>` + segredo global. Aceitável enquanto **PREPARADO**; resolver antes de ligar o iFood em produção multi-tenant. |
| **BAIXO** | Sem rate-limiting explícito nas rotas públicas (`/api/track`, webhooks). O token de tracking (192 bits) torna brute-force inviável; webhooks exigem assinatura. Um WAF / rate-limit na borda (Vercel, Cloudflare) é recomendado em produção. |
| **BAIXO** | Indicadores acima de 20 000 pedidos/período viram estimativa sobre amostra. Para esse volume, o próximo passo é agregação em SQL (RPC) ou tabela materializada. |
| **BAIXO** | `next dev` no Windows às vezes mostra erros de HMR obsoletos no console — não afeta produção (`next build` limpo). |

---

## Fase 3.5 — endurecimento adicional

| Item | Como |
|---|---|
| **Admin da plataforma** | `platform_admins` + `is_platform_admin()`. Validado no **backend** (`apps/admin/lib/context.ts` com `service_role`), nunca por flag de cliente. Login recusa e desloga quem não está na tabela. Cookie próprio `sb-leeva-admin`. Policies `... admin lê todos` dão leitura ampla (suporte); escrita continua restrita. |
| **Rate limiting** | Janela deslizante em `rate_limit_hits` (`rate_limit_check`), funciona em serverless. Aplicado a `/api/v1/deliveries`, `/api/integrations/orders`, `/api/track/:token`, `/api/webhooks/:provider`, `/api/geocode`, `/api/cron/dispatch-tick`. 429 + `Retry-After`. Fail-open em erro de infra (com log). |
| **Chaves de API por restaurante** | `api_keys` — só o hash sha-256; chave crua exibida 1x. Revogação (`revoked_at`). `last_used_at` para auditoria. Só o dono gera/revoga. `LEEVA_API_KEY` global fica só para dev. |
| **Cron idempotente sob concorrência** | LEASE com TTL (`acquire_dispatch_lease`) — duas execuções sobrepostas: uma roda, a outra é ignorada (`dispatch_runs.skipped = true`). `runDispatchTick` interno segue CAS. Testado em `test:concurrency` e `test:fase35`. |
| **Observabilidade sem vazar dados** | `captureError` sanitiza `detail` (remove telefone/endereço/chave/payload) antes de gravar em `error_events` / enviar ao Sentry. |
| **Reputação justa** | Recusar oferta `poor` nunca gera incidente/penalidade. Incidente com `origin ≠ driver` fica só como registro. |

### Testes (`npm run test:fase35`, 21 checagens)

Qualidade de oferta (boa/ruim, `counts_for_acceptance`), aceitação justa
(recusa de `poor` vs adequada), incidentes por origem, índice de confiabilidade
(amostra pequena, nenhum eixo domina), bloqueio de entregador sai do pool,
lease/concorrência do cron, rate limit, chaves de API (emitir/resolver/revogar),
agregações do admin, e **RLS**: cliente anônimo não lê `platform_admins`,
`dispatch_runs`, `error_events`, `reputation_config`, `rate_limit_hits`,
`driver_incidents`, `api_keys`.
