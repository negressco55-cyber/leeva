# Decisões noturnas — sessão autônoma (2026-08-31 → 01/09)

Registro das decisões tomadas sem validação humana durante a execução autônoma
dos blocos B, C, 4, 5 e do redesign. Cada item: o que estava ambíguo, o que
decidi e por quê. O usuário revisa de manhã.

Regra seguida: travar só em mudança de arquitetura ou algo irreversível/arriscado.
Nunca tocar em Asaas produção nem integração iFood.

---

## Bloco B — Notificação push ✅

**Feito:**
- Migration `0026_fase5_push_subscriptions.sql`: tabela `push_subscriptions`
  (1 linha por dispositivo), coluna `motoboys.push_enabled`.
- `packages/shared/src/services/push.ts` — Web Push real via lib `web-push`
  + VAPID. Remove assinatura morta (404/410) automaticamente.
- `notify-driver.ts` — helper único `notifyDriver()` (in-app + push).
- Service worker `apps/motoboy/public/sw.js` (push + clique).
- `NotificationSetup.tsx` na tela de Status: cartão claro pedindo permissão,
  auto-dispara quando o motoboy fica online; some quando ativo (deixa só
  "🔔 Notificações ativas — enviar teste").
- Gatilhos de push: nova oferta (autodispatch), entrega cancelada após
  aceite (orders.advanceOrderStatus), repasse pago/falhou (driverpayouts).
- Chaves VAPID geradas e configuradas na Vercel (projeto leeva-motoboy) e
  no `.env.local`. Valores não expostos no chat.

**Decisões tomadas sozinho:**
1. **Permissão pedida ao ficar online, não no cadastro.** O prompt original
   dizia "peça permissão claramente no primeiro 'available'". Implementei
   exatamente isso: o cartão aparece na tela de Status e o `requestPermission`
   dispara automaticamente quando `status !== 'offline'`. Antes disso o
   cartão fica visível mas sem forçar o pop-up.
2. **Repasse pago/falhou = só push, sem in-app.** A tabela `notifications`
   exige `restaurant_id` (NOT NULL) e um repasse não tem restaurante único.
   Em vez de migração para afrouxar a coluna (mudança de schema com impacto
   em RLS), o aviso de repasse vai só por push — a tela Pagamentos já mostra
   o histórico de repasses de qualquer jeito.
3. **web-push como lib de envio** (padrão de mercado, sem serviço pago).
   Sem provedor VAPID configurado, `sendPushToMotoboy` vira no-op explícito
   (`skipped:true`) — nada finge que enviou.
4. **Sem cache offline no service worker** por enquanto — só o canal de
   notificações. PWA installability plena fica pro redesign (Parte 2).

**Não testável 100% sem device real:** o envio de verdade depende de uma
subscription gerada por um navegador. Os testes cobrem toda a lógica de
banco/erro; o `POST /api/push/test` permite o usuário confirmar no celular.

---

## Bloco C — Agrupamento de entregas com precificação incremental ✅

**Feito:**
- Migrations `0027` (colunas de grupo em orders/dispatch_attempts + config) e
  `0028` (`credit_adjust` — ajuste de crédito com sinal).
- `services/grouping-dispatch.ts`: `planGroupForOrder` (monta a rota),
  `applyGroupPlan` (grava + ajusta crédito), `dissolveGroup` (desfaz).
- Integração no `autodispatch`: antes de ofertar um pedido, tenta montar
  uma rota com vizinhos; se conseguir, cria UMA oferta agrupada.
- `acceptOffer` agrupado → atribui todos os pedidos ao mesmo motoboy.
- `declineOffer` / timeout agrupado → dissolve o grupo.
- Oferta no app do motoboy mostra a sequência de paradas, o valor de cada
  parada e o total da rota (`OffersPanel`).
- Admin (Planos & Taxas): piso da parada extra, raio de agrupamento e
  máximo de paradas — todos configuráveis, nada fixo no código.
- Testes: `scripts/test-fase5c.mjs` (6/6) — rota de 2 e 3 paradas, recusa,
  destino distante fora do grupo, ajuste de crédito.

**Preço implementado (exatamente como o prompt pediu):**
- Parada 1 (lead) = tabela cheia: `base + max(0, km−free_km)×per_km`, ≥ mínimo.
- Parada k>1 = `max(group_stop_min, kmIncremental(parada k-1 → k) × per_km)`.
  Sem `free_km` nas paradas extras (já estão perto). Piso inicial R$ 3,50.
- Restaurante paga por pedido = valor do motoboy daquela parada + margem do plano.

**Decisões tomadas sozinho:**
1. **Recusa dissolve o grupo** (a mais simples). Oferta agrupada recusada ou
   expirada → cada pedido volta ao despacho individual normal, com a cobrança
   cheia recomposta. Motivo: evita uma "rota fantasma" quicando entre motoboys
   mal posicionados e não exige uma máquina de estado nova de oferta agrupada.
   Reaproveita 100% o caminho individual que já existia e é testado.
2. **Ajuste de crédito no agrupamento.** O crédito é debitado pelo valor cheio
   na criação (regra da Fase 4, não mexi nela). Quando o despacho agrupa e a
   cobrança do 2º+ pedido cai, o Leeva **devolve a diferença** ao crédito do
   restaurante (lançamento `adjustment` no extrato). Se o grupo é desfeito,
   volta a cobrar. Alternativa (consumir crédito só no despacho) mudaria a
   arquitetura da Fase 4 — não fiz sozinho.
3. **Agrupa só pedidos com a mesma forma de pagamento** (não mistura "recebe
   na entrega em dinheiro" com "pago online") — evita confundir a cobrança na
   porta do cliente.
4. **Ordenação da rota = vizinho mais próximo** a partir do restaurante. Não é
   um solver de rota ótimo (VRP), é uma heurística boa o suficiente e barata.
   OSRM, quando ligado (Bloco 5), melhora as distâncias das pernas.
5. **Ligado por padrão** (`group_max_stops = 3`). Para desligar, o admin põe
   `máximo de paradas = 1`.

**Pendência menor:** a tela do restaurante ainda não destaca "este pedido foi
agrupado com os pedidos X e Y". O valor cobrado já aparece certo. Anotado para
o redesign.

---

## Bloco 4 — Comunicação automática com o cliente + rastreamento público ✅

**Estado encontrado:** a maior parte já existia da Fase 2 —
`services/tracking.ts` (token aleatório, expira em 48h, revogável),
página pública `/track/[token]` com atualização ao vivo, API com rate limit,
`events.ts` disparando notificação do cliente em mudança de status, e o
`NotificationService` com WhatsApp/SMS "PREPARADOS" (ligam sozinhos quando
`WHATSAPP_*` / `TWILIO_*` entram no ambiente).

**Feito nesta noite:**
- Token de rastreamento **criado já na criação do pedido** (antes só quando o
  restaurante clicava "gerar link").
- **Link de rastreamento vai junto de toda notificação do cliente** — no corpo
  (WhatsApp/SMS) e em `notifications.data.tracking_url` (in-app). Helper
  `trackingUrl()` + env `LEEVA_TRACKING_BASE_URL` nos 3 apps da Vercel.
- Novo aviso **"um entregador está a caminho"** quando a oferta é aceita
  (`customer.driver_assigned`) — antes o cliente só sabia no "saiu para entrega".
- Testes: `scripts/test-tracking.mjs` (7/7).

**Decisão / limite honesto:**
- **Sem provedor externo, a notificação não *chega* ao cliente sozinha.** O
  Leeva não tem canal próprio para o cliente final (WhatsApp Business API e SMS
  são pagos; iFood está fora do combinado). O que está pronto: a página de
  rastreamento pública e automática, o link sempre disponível para o
  restaurante repassar, e todo o encanamento para o envio automático disparar
  no segundo em que `WHATSAPP_TOKEN`/`TWILIO_*` forem configurados. Não inventei
  um "canal fake" — as notificações externas ficam com status `skipped` e o
  motivo, exatamente como o resto do sistema já faz.
- A detecção de "pedido chegando" (`delivery.nearby`) por proximidade GPS ficou
  de fora — exige um watcher de localização com histerese; anotado como
  melhoria futura. Os outros 4 marcos (confirmado, a caminho, saiu, entregue)
  estão cobertos.

---

## Bloco 5 — Rota real (OSRM) no lugar da linha reta ✅

**Estado encontrado:** `OsrmRoutingService` já estava escrito (PREPARADO),
só faltava ligar. Os cálculos de distância já tratavam `null` do provedor
caindo para Haversine × 1,3 — então a troca é segura.

**Feito:**
- `HybridRoutingService`: envolve o OSRM com fallback automático para linha
  reta (se o OSRM falha por rede/rate-limit/ponto sem via, não perde a
  estimativa) + cache curto em memória (5 min, 500 pernas) para não martelar
  o servidor OSRM.
- `OSRM_BASE_URL` = `https://router.project-osrm.org` nos 3 apps da Vercel e
  no `.env.local`.
- Testado ao vivo: restaurante → Bessa deu **4,95 km reais** contra ~1,7 km
  da linha reta ×1,3 (tem rio/ponte no caminho) — a diferença é exatamente
  o que justifica a rota real.
- Testes: `routing.test.ts` +4 (usa real, cai para fallback, cacheia).

**Decisão / aviso:**
- Usei o **servidor OSRM público** (`router.project-osrm.org`). Ele tem rate
  limit e os termos dele desaconselham produção pesada. Para volume real, subir
  uma instância própria de OSRM (Docker + extrato do OpenStreetMap do Nordeste)
  e trocar só a env `OSRM_BASE_URL`. O fallback garante que, se o público
  bloquear, o sistema continua funcionando na estimativa. Reversível: basta
  apagar a env.
- Não liguei Google Maps / Mapbox (pagos, precisam de chave e cartão).
