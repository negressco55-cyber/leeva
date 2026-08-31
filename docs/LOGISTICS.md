# Logística — despacho automático, frota e remuneração (Fase 3)

## Princípio

O restaurante **não opera a frota**. O fluxo é:

```
RESTAURANTE cria a entrega  (manual, iFood, WhatsApp, cardápio, API)
        ↓
orders.dispatch_state = 'searching'   (automático, se auto_dispatch_enabled)
        ↓
runDispatchTick()  →  scoreCandidatesForOrder()  →  melhor entregador
        ↓
cria dispatch_attempt (oferta)  ·  orders.dispatch_state = 'offered'
        ↓
entregador ACEITA  →  acceptOffer()  →  orders.motoboy_id, status='assigned',
                       dispatch_state='assigned', calcula payout/taxa/rota
   ou RECUSA / TIMEOUT  →  oferta fecha, dispatch_state='searching', próximo tick
        ↓
… max_dispatch_attempts esgotadas  →  dispatch_state='failed' + alerta 'no_driver'
```

O restaurante vê só: **Buscando entregador… · Oferta enviada · Entregador encontrado ·
Em entrega · Atrasado · Concluído**. Nunca a lista/localização/telefone da rede.

## Estado do despacho (`orders.dispatch_state`)

`none` → `searching` → `offered` → `assigned` · `failed`

Ortogonal a `orders.status` (waiting_dispatch…delivered). O restaurante pode
**cancelar** um pedido a qualquer momento; isso fecha a oferta aberta.

## Score do candidato

`scoreCandidatesForOrder()` — determinístico, sem IA. Pesos **configuráveis** em
`restaurants.logistics_config.dispatch_weights` (default):

| Componente | Peso | O que mede |
|---|---:|---|
| `etaToPickup` | 40 | tempo até a coleta (rota real se `OSRM_BASE_URL`, senão estimativa) |
| `routeImpact` | 20 | quanto o novo destino desvia das entregas atuais do candidato |
| `load` | 15 | folga de capacidade (`max_concurrent_deliveries`) |
| `reliability` | 10 | taxa de conclusão (`deliveries_completed / deliveries_total`) |
| `history` | 10 | atrasos históricos (`deliveries_late`, `avg_delay_min`) |
| `rating` | 5 | avaliação 3–5 → 0–1 |

**Bloqueios** (score ≤ 8, nunca recomendado): offline, no limite de entregas, fora do
raio (`service_radius_km × 2`).

**Balanceamento de frota:** dentro de um `tick`, cada oferta já feita a um
entregador conta como carga extra (`tickLoad`) — evita mandar todos os pedidos
para o mesmo entregador de maior score. É um guloso balanceado; a interface fica
aberta para um otimizador de atribuição no futuro.

## Frota (`restaurants.fleet_mode`)

| Modo | Pool de candidatos |
|---|---|
| `own` | só `motoboys` do restaurante com `fleet='own'` |
| `leeva` | só `motoboys` com `fleet='leeva'` e `restaurant_id IS NULL` (rede compartilhada) |
| `hybrid` | frota própria + rede |

RLS: o restaurante **só enxerga** `motoboys` com `restaurant_id = seu` e `fleet='own'`.
Os da rede (`restaurant_id IS NULL`) são invisíveis para qualquer restaurante.

"Minha equipe" (`/equipe`) só aparece no menu em `own`/`hybrid`.

## Remuneração do entregador (`payout_policies`)

Independente da taxa cobrada do cliente. Config em `payout_policies.config`
(por restaurante, ou a global `restaurant_id IS NULL`). **Nada hardcoded.**

```json
{ "base": 7.50, "per_km": 0, "free_km": 2, "grouped_extra": 3.00,
  "peak_bonus": 0, "peak_hours": [[18,21]], "min_payout": 7.50 }
```

`computeDriverPayout(config, { distanceKm, groupSize, at })`:
`base + max(0, dist − free_km)·per_km + (groupSize−1)·grouped_extra + peak_bonus(se pico)`,
nunca abaixo de `min_payout`. Devolve o `breakdown` linha a linha.

Ao salvar em Configurações, o sistema **avisa** se a taxa cobrada não cobrir a
remuneração estimada (prejuízo).

## Agrupamento

`grouping.ts` (Fase 2, endurecido): candidato precisa estar perto de **todos** os
membros (não corrente), máx **4** pedidos por grupo, considera rota real quando
disponível. O `finalizeLogisticsForOrder` conta `group_id` para o adicional de
remuneração por pedido agrupado.

## Financeiro da logística (`finance.ts`)

Por entrega concluída: `leeva_fee − driver_payout = logistics_margin`
(coluna gerada no banco). `getLogisticsFinance()` agrega o período, quebra por
região e por agrupada/simples, e gera **alertas financeiros** com dados reais
(margem negativa, região cara, economia do agrupamento).

`leeva_fee` = `orders.customer_fee` explícito → `logistics_config.customer_fee`.
**Não** usa `orders.delivery_fee` (isso é a taxa da VENDA, dinheiro do restaurante).

## Como acionar o motor

- **Cron REAL (produção):** `pg_cron` + `pg_net` no Supabase chamam
  `POST /api/cron/dispatch-tick` a cada ~30 s. Configurar uma vez com
  `select public.configure_dispatch_cron(url, secret, '30 seconds')` — ver
  `docs/DEPLOY.md §4`. Protegido por `x-cron-secret`.
- **Nudge por restaurante:** `POST /api/dispatch/tick` (a central de operações e o
  mapa chamam ao carregar) e chamadas diretas na criação de pedido / recusa.
- **Wrapper `dispatchTick(db, {source})`** (Fase 3.5): LEASE com TTL (~20 s) para
  o loop global — duas execuções sobrepostas não processam a mesma oferta.
  Registra cada execução em `dispatch_runs` (observabilidade: ofertas, expiradas,
  falhas, `skipped`). O `runDispatchTick` interno continua CAS/idempotente.
- O cron também recalcula o índice de confiabilidade dos entregadores
  (`recomputeAllReliability`, ~1x/min).

Todas as operações são CAS/idempotentes: rodar de vários lugares é seguro.

## Qualidade da oferta + reputação (Fase 3.5)

Antes de ofertar, o motor classifica a **qualidade da oferta** para aquele
candidato (`excellent`/`good`/`acceptable`/`poor`) e grava em `dispatch_attempts`.
Recusar oferta `poor` **nunca** penaliza o entregador. O score do candidato
(seção acima) e a qualidade da oferta são eixos separados. Detalhes:
`docs/REPUTATION.md`. Entregadores `blocked` saem do pool.
