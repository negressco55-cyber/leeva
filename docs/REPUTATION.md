# Reputação e inteligência do motoboy (Fase 3.5)

Dois eixos **independentes**. O algoritmo pergunta as duas coisas antes de ofertar:

1. **O candidato é bom?** → índice de confiabilidade (`motoboys.reliability_index`)
2. **Esta corrida é boa para ele?** → qualidade da oferta (`dispatch_attempts.quality`)

Tudo determinístico, sem IA. Serviço: `packages/shared/src/services/reputation.ts`.

---

## 1. Qualidade da oferta

`classifyOfferQuality({ payout, distancePickupKm, distanceDropoffKm, etaTotalMin, routeFits })`
→ `{ quality, score 0..100, countsForAcceptance, factors }`.

| Rótulo | Score | Recusar penaliza a aceitação? |
|---|---|---|
| `excellent` | ≥ 75 | **sim** |
| `good` | ≥ 55 | **sim** |
| `acceptable` | ≥ 38 | não (impacto zero na aceitação) |
| `poor` | < 38 | **nunca** |

Componentes (pesos em `DEFAULT_OFFER_QUALITY_CONFIG`):

| Fator | O que mede |
|---|---|
| `earningsRate` (34) | R$ por km de esforço (coleta + entrega) |
| `absolutePayout` (24) | valor absoluto da corrida |
| `deadhead` (22) | distância "morta" até a coleta |
| `timeEfficiency` (12) | ETA total |
| `routeFit` (8) | destino cai perto de uma entrega que ele já leva |

Guardado em cada `dispatch_attempts`: `quality`, `quality_score`, `quality_factors`,
`counts_for_acceptance`, `payout_estimate`, `distance_pickup_km`, `distance_total_km`.

### Proteção contra corridas ruins

Quando a melhor oferta possível é `poor`, o Leeva **não obriga ninguém**. A
notificação ao entregador diz explicitamente *"Oferta pouco vantajosa — recusar
não afeta sua reputação"*. Caminhos configuráveis para melhorar a oferta antes de
insistir: agrupamento, rota real (OSRM), bônus de pico/demanda na
`payout_policies`, ampliar raio. Se ainda assim ninguém aceita → `dispatch_state
= failed` + alerta operacional (nada é forjado).

### "Oferta prioritária" (não "irrecusável")

O sistema diz *"Você é o melhor candidato para esta entrega"* — mas o entregador
**pode recusar**. Se a oferta for boa, a recusa conta; se for ruim, não conta.
Isso evita que o algoritmo force corridas economicamente ruins.

---

## 2. Índice de confiabilidade (0..100)

`computeReliabilityIndex(db, motoboyId)` — combina 5 componentes com pesos
**configuráveis** em `reputation_config.config.weights` (default):

| Componente | Peso | Fonte |
|---|---:|---|
| `acceptance` | 20 | `offers_adequate_accepted / offers_adequate` (impacto **suave**: `acceptance_soft_impact` 0.5) |
| `completion` | 30 | `deliveries_completed / deliveries_total` |
| `punctuality` | 20 | entregas no prazo (`sla_minutes`) |
| `rating` | 15 | avaliação 2→5 mapeada para 0→100 |
| `incidents` | 15 | `100 − Σ penalidades` (janela `incident_window_days`) |

- **Nenhum indicador domina**: soma ponderada normalizada, tudo travado em 0..100.
- **Amostra pequena** (`< min_sample`) é puxada para 100 — histórico curto não pune.
- `block_threshold` (45): abaixo disso o Admin pode bloquear (não é automático).

---

## 3. Incidentes e ORIGEM

`driver_incidents(type, origin, severity, note)`. **Só `origin = 'driver'` pesa
no índice.** Restaurante / cliente / sistema entram apenas como registro de
auditoria (severidade 0).

| Tipo | Quando | Penalidade default |
|---|---|---:|
| `decline_adequate_offer` | recusou/expirou oferta adequada | 3 |
| `cancel_after_accept` | aceitou e cancelou (status `assigned`) | 15 |
| `abandon` | aceitou e largou no meio (`picked_up`/`in_route`) | 25 |
| `no_show` | não foi à coleta | 20 |
| `late_delivery` | muito além do ETA | 5 |
| `complaint` | reclamação registrada | 8 |

`advanceOrderStatus(..., { cancelOrigin, cancelReason })` grava o incidente no
cancelamento pós-aceite. O gatilho `track_offer_acceptance` mantém os contadores
de oferta adequada e registra `decline_adequate_offer` automaticamente.

---

## 4. Transparência para o entregador

App do motoboy → aba **Desempenho** (`/desempenho`, `GET /api/performance`):
índice, avaliação, aceitação, finalização, pontualidade, explicação amigável e
dicas ("Melhore a pontualidade…") — **sem** revelar a fórmula interna.
Cada oferta mostra qualidade, valor, distância e se a recusa conta.

---

## 5. Recálculo

- No cron (`/api/cron/dispatch-tick` chama `recomputeAllReliability` ~1x/min).
- Ao registrar incidente (`recordIncident` → `computeReliabilityIndex`).
- Ao abrir o painel de desempenho / detalhe no Admin.

Pesos e limiares editáveis em **Admin → Reputação** (`/api/reputation-config`).
