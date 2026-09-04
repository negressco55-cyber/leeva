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

---

## Parte 2 — Redesign dos 3 apps ✅

**Feito:**
- `docs/DESIGN-SYSTEM.md` — sistema de design completo: princípios, paleta
  (clara por padrão + escuro), escala tipográfica, espaçamento, specs de
  componente, e uma lista explícita dos **clichês de IA proibidos**.
- `globals.css` dos 3 apps reescritos sobre o novo sistema, **mantendo todos
  os nomes de classe** já usados (`.card`, `.btn`, `.button`, `.input`,
  `.tag`, `.op-alert`, `.stat`, `.tbl`, `.tabbar`, `.offer-*`...). Zero
  mudança de estrutura de componente → baixo risco.
- Aliases retrocompatíveis (`--accent` → `--brand`, `--panel` → `--surface`)
  para os `style={{}}` inline que usam essas variáveis não quebrarem.
- Cores hardcoded de tema escuro nos componentes (`#f87171`, `#fca5a5`,
  `#86efac`, `#fbbf24`...) trocadas por tokens (`var(--danger)` etc.) — assim
  funcionam nos dois temas.
- Setas `→` removidas dos botões ("Ver entrega atual", "Abrir mapa completo",
  "Abrir endereço no mapa"). Peso de fonte 800 → 650. `text-transform` zerado
  no reset global.
- Verificado no navegador nos 3 apps, tema claro e escuro: login, visão geral,
  pedidos, restaurantes (admin), status (motoboy).

**Direção de design escolhida (decisão minha):**
- **"Ferramenta de trabalho", não site de marketing.** Sóbrio, denso,
  legível com pressa.
- **Claro por padrão** (restaurante trabalha de dia; modelo mental de
  comanda impressa), com modo escuro real via `prefers-color-scheme`.
- **Neutro cinza-quente** (`#f7f7f5`, hue ~40°, saturação < 4%) — explicitamente
  **não** bege/terracota.
- **Uma cor de marca: verde-pinho** (`#1f6f5c`). Troquei o laranja `#ff5a1f`
  anterior — laranja é a cor-clichê de app de delivery. Verde = movimento,
  confiança, "pode ir".
- **Elevação é exceção**: sombra só no `.offer-card`, modais e popovers. Todo
  o resto se separa com fundo (`--surface-2`) e linha de 1px.
- Botões sem ícone/seta. Rótulos em caixa normal, sempre.

**Escopo — o que fiz e o que não:**
- Fiz: a **linguagem visual** (cor, tipografia, superfícies, botões, inputs,
  tabelas, tags, navegação) trocada de forma sistemática nos 3 apps.
- Não fiz: rework tela a tela das telas secundárias (cada formulário de
  config, cada sub-página). A estrutura delas foi preservada e herda o novo
  visual, mas algumas ainda têm grades de KPI com "vários cards iguais" que o
  design system pede para consolidar. É a evolução natural: dá para ir
  refinando tela por tela sem mais nenhuma mudança de base.
- Ícones emoji na navegação (📦 🗺️) foram **mantidos** — o usuário não os
  listou como clichê e eles ajudam a orientação. O design system os marca
  como opcionais/decorativos.

---

## Extra — app nativo do motoboy (Android) a partir do zip "Levva-clone"

O usuário mandou um zip com uma segunda versão do Leeva (stack diferente:
Express + Prisma + Socket.io + app Expo/React Native). Pedido: **portar só o
app nativo do motoboy** e manter o resto do nosso Leeva.

**Feito:**
- `apps/motoboy-app/` — app Expo/RN, **fora do workspace npm** (deps de React
  Native não convivem com as dos apps web; tem `node_modules` e lockfile
  próprios). Vercel não toca nele; turbo não vê.
- Camada de dados reescrita: `@supabase/supabase-js` (login, tempo real) +
  `fetch` nas rotas `/api/*` do `apps/motoboy` com `Authorization: Bearer`
  (access token do Supabase). Socket.io → Supabase Realtime.
- Backend: `getMotoboyContextFromReq(req)` aceita Bearer **além** do cookie
  (PWA continua igual). Novas rotas JSON: `/api/me`, `/api/entrega`,
  `/api/historico`, `/api/push/expo`.
- Push nativo via **Expo Push Service** — `push_subscriptions.kind` ('web' |
  'expo'), migration 0029. `sendPushToMotoboy` agora envia pros dois canais.
- Telas adaptadas ao nosso modelo (ofertas com `dispatch_attempts`, entregas
  com `orders`, ofertas agrupadas, gate de aprovação + termos).
- `expo-doctor` 21/21, `tsc` limpo, bundle Android gera sem erro.

**Decisões tomadas sozinho:**
1. **App nativo = cliente fino sobre as rotas `/api` que o PWA já usa.** Em
   vez de duplicar a lógica de negócio (aceitar oferta, avançar status) ou
   abrir o RLS pro cliente nativo, o app chama os mesmos endpoints. Só
   precisou o Bearer no backend.
2. **Cadastro de novo entregador continua no site.** O `/quero-entregar` tem
   upload de documentos (CNH/RG + CRLV) — refazer isso em RN com câmera/picker
   é um projeto à parte. O app tem um botão que abre o cadastro no navegador.
3. **Chave Pix: só leitura no app** por enquanto (mesma razão — o fluxo bom
   é no painel). Dá pra adicionar edição depois.
4. **Tema escuro no app nativo** (o design system é claro-primeiro). Deliberado:
   entregador usa na rua/à noite, tela escura poupa bateria. Usa a MESMA cor de
   marca (verde) e os mesmos tokens da versão escura do design system.
5. **GPS só em primeiro plano** nesta primeira versão. Rastreamento em segundo
   plano (app fechado) precisa de `expo-task-manager` + `expo-location`
   background + configuração extra de build — anotado como próximo passo.
6. **Servidor OSRM público** (já era assim no resto do Leeva).

**O que falta pro app ir pra loja (precisa do usuário):**
- Conta Expo (grátis) + `eas build` → gera o APK/AAB. `apps/motoboy-app/README.md`
  tem o passo a passo.
- Para o push nativo funcionar no APK standalone: `google-services.json` (FCM) —
  o assistente do `eas build` guia.
- Publicar na Play Store: conta de desenvolvedor Google (US$ 25, uma vez).
- Testar num aparelho real (Expo Go): login, ficar online, receber oferta,
  aceitar, fluxo de entrega, notificação.

---

## App nativo — ícone, GPS em segundo plano, preparação de build (01/09)

Sessão "usuário fora, sem token da Expo". Adiantado tudo que não depende de
autenticação. Resumo em `docs/RESUMO-2026-09-01-app-nativo.md`.

**Decisões tomadas sozinho:**

1. **`app.json` virou `app.config.js` (config dinâmica).** Motivo: o pedido era
   "o código reconhece o `google-services.json` sozinho, sem mais mudança
   depois". Com config estática isso não dá; com `app.config.js` eu checo
   `fs.existsSync('google-services.json')` e injeto `googleServicesFile` só se
   existir. É o padrão do Expo pra isso, reversível, e não muda comportamento
   nenhum enquanto o arquivo não está lá.
2. **Ícone: um "L" terminando num pino de rota**, verde-pinho do design system.
   Não reaproveitei o chevron "A" azul do zip (era rascunho, com as linhas de
   grade aparecendo, e azul). Gerado com `sharp` a partir de um SVG; todos os
   tamanhos do Expo (icon, adaptive foreground dentro da zona segura,
   monochrome, splash).
3. **A task de segundo plano é a ÚNICA que manda localização pro servidor
   quando há entrega ativa.** O `watchPositionAsync` de primeiro plano passou a
   só alimentar o mapa (`setPosition`), sem `POST /api/location`. Assim não tem
   envio duplicado quando o app está aberto com o foreground service rodando.
   Sem entrega ativa (só "disponível"), o foreground watch volta a enviar.
4. **Rastreamento em segundo plano liga/desliga sozinho pelo `activeDelivery`.**
   Enquanto há entrega → `startLocationUpdatesAsync` com foreground service +
   notificação fixa. Sem entrega / offline / logout → `stopLocationUpdatesAsync`.
   Nada de ficar drenando bateria fora de entrega.
5. **Testes só da lógica pura** (`locationPayload.ts`: throttle, montagem do
   payload, "última leitura do lote"). O comportamento nativo (foreground
   service, permissão background) só dá pra validar num device/build — anotado.
6. **`eas.json` com as env NÃO-secretas embutidas** (`EXPO_PUBLIC_API_URL`,
   `EXPO_PUBLIC_SUPABASE_URL`). A chave anon do Supabase fica no `.env` local
   (gitignored) que o EAS lê no build — não no `eas.json` (que vai pro repo
   público).
7. **Indicadores das telas de admin/restaurante: consolidação via CSS.**
   `.stat-row` deixou de ser "vários cartões com borda" e virou um cartão só
   com divisórias de 1px entre os números (o design system pedia isso).
   Fiz no CSS em vez de reescrever cada tela — mesma melhora, risco quase zero,
   pega Visão geral / Financeiro / Unit economics / Entregadores / Repasses /
   detalhe do restaurante de uma vez.
8. **`delivery.nearby` (pedido chegando):** descobri que **já estava
   implementado** em `recordDriverLocation` (< 400 m do destino, idempotente).
   Estava listado como pendente por engano na sessão anterior. Só adicionei um
   teste (`test-tracking.mjs`).

**Nada disso é irreversível ou arquitetural** — o PWA em produção não foi
tocado, o backend só ganhou o teste novo, e todo o resto é o app nativo (que
ainda não está publicado em lugar nenhum).

---

## Build do APK, Sentry, auditoria (02/09) — resumo em `RESUMO-2026-09-02-build-e-auditoria.md`

**Decisões tomadas sozinho:**

1. **Slug do projeto EAS = `leeva`** (não `leeva-motoboy`). O prompt dizia "o
   slug precisa bater com `leeva-motoboy`", mas o projeto que o usuário criou
   na Expo (`5c851aad-...`, org `leeva-jp`) tem slug real `leeva`. Segui o real
   — é o único jeito do `eas build` funcionar. Ajustei `app.config.js`
   (`slug` + `owner: 'leeva-jp'`).
2. **Sentry só em restaurante + admin, NÃO no PWA `apps/motoboy`.** A Parte 2
   pedia "3 apps web", mas a regra "não mexer no PWA de produção" está no mesmo
   prompt e é absoluta. Como o Sentry é no-op sem DSN, não há perda em esperar
   o usuário. Receita pra adicionar depois está no `SENTRY-SETUP.md`.
3. **`withSentryConfig` no next.config** (em vez de um setup manual mais
   enxuto). O `@sentry/nextjs` puxa módulos Node pro bundle edge e quebra o
   build sem ele — é o caminho oficial. Configurado pra não exigir
   `SENTRY_AUTH_TOKEN` no build (source map upload fica opcional).
4. **`sourcemaps.disable` condicional ao `SENTRY_AUTH_TOKEN`** — sem token, o
   build nem tenta subir source map (senão falharia).
5. **Botão "Entrar" do admin → `.btn.primary`** (era um `.btn` sem `primary`,
   que no design system novo renderiza secundário/branco). Inconsistência com
   os outros 2 logins; corrigido.
6. **Auditoria: nada crítico.** RLS ok nas 35 tabelas, rotas de API todas
   escopadas, zero segredo hardcoded, zero `console.log`/`TODO`. Detalhe no
   resumo do dia.
7. **`EXPO_PUBLIC_SUPABASE_ANON_KEY` via `eas env:set`** (comando novo; o
   `eas env:create` está deprecado) no ambiente `preview`, visibilidade
   `sensitive`. A chave anon é pública por design, mas `sensitive` evita ela
   aparecer em logs de build.

---

## Validação de endereço + performance do painel (02/09, tarde)

### Performance do painel do restaurante

1. **`loading.tsx` no grupo `(app)`.** Não existia tela de carregamento em
   lugar nenhum — o Next bloqueava a navegação até o server component resolver
   todos os `await`, e a tela "congelava" a cada clique. Esqueleto instantâneo
   resolve a percepção. Foi a causa nº 1 do "trava muito".
2. **`requireRestaurantContext` / `getApiContext` com `React.cache()`.** Eram
   chamados 2× por navegação (layout + página) → 2 `auth.getUser()` (ida e
   volta à Supabase). `cache()` deduplica na mesma request.
3. **Polling só com a aba visível, a 20s** (Visão geral + Mapa; era 12s
   sempre). Relógio da Visão geral isolado em `<Clock/>` — antes re-renderizava
   o mapa inteiro a cada segundo.
4. **Removido `DashboardLive.tsx`** — componente morto, não importado, com
   links quebrados (`/despacho`, `/motoboys`).

### Bug: endereço inventado gerava pedido + tarifa + oferta

**Encontrado em teste:** "rua aaaaa, número aaaaa" criava pedido normalmente.
Causa: nada geocodificava o endereço; sem coordenada, a tarifa caía no piso
(`base`/`min_payout`) e o despacho seguia.

5. **Novo `services/address.ts` — `resolveDeliveryLocation` / `resolvePickupLocation`.**
   Geocodifica o endereço antes de criar o pedido. Três desfechos:
   - **localizado** (perto do restaurante, precisão de rua ou melhor) → segue
     com a coordenada do geocoder (ignora lat/lng que o cliente mandou — mata
     o vetor "digitar lat/lng falsa");
   - **não encontrado** (ou match ruim: longe demais / só nível cidade) →
     **bloqueia** com "Não conseguimos localizar esse endereço…";
   - **geocoder instável** (rede/timeout/5xx/429 — agora `GeocoderUnavailableError`,
     distinto de "não encontrado") → **não bloqueia à toa**: pede uma
     confirmação manual do restaurante (checkbox + lat/lng). Sem confirmação,
     responde 503 "serviço de mapas instável, tente de novo".
6. **Aplicado em todos os pontos de entrada:** `/api/orders` (manual),
   `/api/v1/deliveries`, `/api/integrations/orders`, pipeline de webhooks
   (menos rascunho de WhatsApp, que ainda passa por confirmação humana) e
   `/api/onboarding` (endereço de coleta do restaurante).
7. **Rede de segurança em `createOrderFromNormalized`:** pedido "pra valer"
   (sem `requireConfirmation`) não nasce sem coordenada de entrega — retorna
   `code: 'address_not_found'`. Rascunho de WhatsApp continua podendo nascer
   sem coordenada (é revisado antes).
8. **`MAX_DELIVERY_RADIUS_KM = 60`.** Correspondência de geocoding além disso a
   partir do ponto de coleta é quase certamente um match errado — tratada como
   "não encontrado". Restaurante que realmente mudar pra >60 km usa o caminho
   de confirmação manual.
9. **Teste de regressão:** `scripts/test-address.mjs` (11 casos), com geocoder
   falso determinístico (via `__setMapProvider`) pra não depender de rede.
   Cobre o caso exato reportado.

---

## iFood — integração por polling (02/09, sandbox)

Pedido do usuário: configurar credenciais de sandbox reais (Client ID/Secret/
Merchant ID) e testar o fluxo completo. Pausei antes de agir porque contrariava
a regra repetida em toda sessão ("nunca iFood") — usuário confirmou
explicitamente que queria seguir mesmo assim ("pode sim").

1. **Doc `docs/IFOOD-INTEGRACAO.md` citado pelo usuário não existia.** O real
   é `docs/INTEGRATIONS.md#ifood`. Avisei antes de continuar.
2. **O código existente (`ifood.ts`) estava arquitetado errado** — assumia
   webhook push do iFood. A Merchant API v1.0 real é por *polling*: o
   parceiro autentica via OAuth, busca eventos, confirma recebimento, busca
   o pedido. Implementei esse fluxo de verdade em vez de só "configurar 3
   variáveis" (que não teria funcionado sobre o código antigo).
3. **Testado contra o sandbox real:** autenticação OAuth foi recusada pelo
   iFood ("Unsupported grant type client_credentials to client <id>").
   Confirmei que o formato do request está correto (testei a variante
   snake_case padrão OAuth2 também, que dá um erro diferente/pior). É uma
   configuração do app no portal de parceiros do iFood, não um bug daqui —
   documentado o que conferir em `docs/INTEGRATIONS.md#ifood`.
4. **Credenciais reais só em `apps/restaurante/.env.local`** (gitignored),
   nunca no código, no chat de novo, ou em commit.
5. **Não fiz merge pra `main`** — ficou em `feature/ifood-sandbox` (branch
   separada da do redesign) esperando: (a) você resolver a configuração do
   app no portal iFood, (b) revisar o código antes de ir pra produção. É
   integração nova com um provedor de pedidos externo — trato com a mesma
   cautela do Asaas.
