# Integrações — estado e configuração

Classificação (aparece também na tela **Integrações** do painel):

| Rótulo | Significado |
|---|---|
| **IMPLEMENTADO** | Funciona com a configuração atual. |
| **PREPARADO** | Código, webhooks e normalização prontos. Falta credencial / aprovação / config externa. Não simula nada — recusa com erro explícito enquanto não configurado. |
| **MOCK** | Só para desenvolvimento/teste. Marcado como `MOCK / DEVELOPMENT ONLY` no código. |

Resumo:

| Integração | Tipo | Estado | Falta |
|---|---|---|---|
| Manual | fonte de pedido | **IMPLEMENTADO** | — |
| Cardápio / API própria | fonte de pedido | **IMPLEMENTADO** | gerar `x-leeva-api-key` (abaixo) |
| iFood | fonte de pedido | **PREPARADO** | `IFOOD_ACCESS_TOKEN`, `IFOOD_WEBHOOK_SECRET`, app aprovado + merchant homologado |
| WhatsApp (pedidos) | fonte de pedido | **PREPARADO** | `WHATSAPP_*`, número de produção aprovado |
| WhatsApp (notificações) | canal | **PREPARADO** | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| SMS (Twilio) | canal | **PREPARADO** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| Web Push | canal | **PREPARADO** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` + assinatura do device |
| Rotas / mapas | routing | **PREPARADO** (cai para linha reta) | `OSRM_BASE_URL` para rota real |
| Tiles / geocoding do mapa | mapa | **IMPLEMENTADO** (OSM + Nominatim, sem chave) | `MAPBOX_TOKEN` para trocar por Mapbox (opcional) |
| API de logística (`/api/v1/deliveries`) | fonte de pedido | **IMPLEMENTADO** | gerar `x-leeva-api-key` por restaurante |
| Cron de despacho | motor | **IMPLEMENTADO** (nudge) / **PREPARADO** (cron) | agendador chamando `/api/cron/dispatch-tick` + `CRON_SECRET` |
| Cobrança SaaS (gateway) | financeiro | **PREPARADO** | `billing_events` + `estimatedTotal` prontos; falta plugar gateway/NF |
| IA WhatsApp | IA | **IMPLEMENTADO** (heurística) / **PREPARADO** (LLM) | `ANTHROPIC_API_KEY` para leitura por LLM |

---

## Endpoints

| Rota | Uso |
|---|---|
| `POST /api/orders` | pedido manual (sessão do painel) |
| `POST /api/integrations/orders` | cardápio próprio / API — header `x-leeva-api-key` |
| `POST /api/webhooks/ifood?restaurant=<id>` | webhook do iFood |
| `GET/POST /api/webhooks/whatsapp?restaurant=<id>` | webhook do WhatsApp (GET = verificação `hub.challenge`) |
| `POST /api/cron/cleanup` | retenção de dados — header `x-cron-secret` |
| `POST /api/v1/deliveries` | **Fase 3** — API de entrada de logística (payload flat), header `x-leeva-api-key`, idempotente por `external_order_id` |
| `POST /api/cron/dispatch-tick` | **Fase 3** — loop do motor de despacho — header `x-cron-secret` |

### `POST /api/v1/deliveries` (Fase 3 — API de logística)

O Leeva **não** recebe o pedido comercial — só os dados de logística. O sistema do
restaurante (WhatsApp/iFood/site/próprio) mantém a venda; envia para cá:

```json
{
  "external_order_id": "PEDIDO-99",
  "customer_name": "Fulano", "customer_phone": "5583999990000",
  "address": "Rua X, 10 - Bessa", "latitude": -7.07, "longitude": -34.84, "region": "Bessa",
  "payment_method": "pix", "payment_status": "paid",
  "order_value": 45, "delivery_fee": 8,
  "notes": "portão azul", "items": [{ "name": "Pizza", "quantity": 1 }]
}
```

`items` é **opcional**. Retorno `201 { delivery_id, order_number, status: "accepted",
dispatch: "searching_driver" }` ou `200 { status: "existing" }` se `external_order_id`
repetir. Cada restaurante tem sua própria chave (`integrations.config.api_key_hash`) —
não há credencial global multi-tenant.

### Despacho automático — cron

`POST /api/cron/dispatch-tick` (header `x-cron-secret`) deve rodar a cada ~15–30 s
em produção (Vercel Cron, GitHub Actions, worker externo). Ele expira ofertas
vencidas, oferta pedidos pendentes ao melhor entregador e marca `failed` os que
esgotaram tentativas. Sem esse cron, o despacho só avança quando alguém abre a
central de operações ou o mapa (que dão um "nudge" via `/api/dispatch/tick`).

Idempotência: todo webhook grava em `integration_events` com `unique(provider, event_id)`;
o pedido em `orders` tem `unique(restaurant_id, source, external_id)`. O mesmo
evento externo nunca cria dois pedidos.

---

## <a id="manual"></a>Manual
Criado pela equipe no painel (**Pedidos → + Novo pedido**). Sem webhook. Coordenadas
são opcionais mas melhoram despacho, ETA e rastreamento.

## <a id="cardapio-api"></a>Cardápio / API própria
`POST /api/integrations/orders` com `x-leeva-api-key`. Payload:
```json
{
  "external_id": "PEDIDO-99",
  "customer": { "name": "Fulano", "phone": "5583999990000" },
  "items": [{ "name": "Pizza", "quantity": 1, "unit_price": 45 }],
  "address": { "formatted": "Rua X, 10 - Bessa", "latitude": -7.07, "longitude": -34.84, "region": "Bessa" },
  "delivery_fee": 8, "total": 45
}
```
**Gerar a chave:** o hash SHA-256 da chave vai em `integrations.config.api_key_hash`
do restaurante. Enquanto não houver UI para isso, use `LEEVA_API_KEY` no `.env`
(dev, restaurante único) ou insira via SQL:
```sql
update integrations set config = config || jsonb_build_object('api_key_hash', '<sha256-da-chave>')
where restaurant_id = '<id>' and provider = 'menu';
```

## <a id="ifood"></a>iFood
Fluxo: `iFood → webhook → IFoodOrderProvider.verifyWebhook (HMAC x-ifood-signature)
→ parse → NormalizedOrder → createOrderFromNormalized`.
`pushStatus` mapeia `preparing→confirm`, `in_route→dispatch`, `delivered→conclude`,
`cancelled→requestCancellation` (chama `merchant-api.ifood.com.br`).

**Falta:** credenciais de app aprovadas + OAuth (fluxo de refresh do
`IFOOD_ACCESS_TOKEN` **não** está incluído), homologação do merchant. Sem
`IFOOD_WEBHOOK_SECRET`, `verifyWebhook` retorna `false` e nenhum pedido é criado.

## <a id="whatsapp"></a>WhatsApp
Fluxo: `WhatsApp Cloud API → webhook → verify (HMAC x-hub-signature-256) →
extractMessage → parseWhatsAppOrder (IA) → NormalizedOrder [requireConfirmation] →
pedido com nota "[A CONFIRMAR]"`.

- `GET /api/webhooks/whatsapp` responde `hub.challenge` se `hub.verify_token ==
  WHATSAPP_VERIFY_TOKEN`.
- A IA **nunca** cria pedido irreversível: o pedido entra como rascunho a
  confirmar pela equipe.

**Falta:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN` e número de produção aprovado pela Meta.

## <a id="rotas"></a>Rotas / mapas
`RoutingService` isola o provedor. Sem config → `StraightLineRoutingService`
(Haversine × 1.3 de fator de rua, marcado `isEstimate: true`). Com
`OSRM_BASE_URL` → rota real (ex: `https://router.project-osrm.org`, mas rode a sua
instância em produção). Google/Mapbox: pontos de extensão prontos em
`getRoutingService()`.

## <a id="whatsapp"></a><a id="sms"></a><a id="push"></a>Canais de notificação
`NotificationService` sempre grava a versão **in-app** (visível no painel e no
rastreamento). Se houver telefone + canal externo configurado, tenta também por
lá. Se o canal não está configurado, a notificação fica `status = 'skipped'` com
o motivo em `error` — **nunca** marca como enviada sem enviar.
