# Resumo — 01/09/2026 · Preparar o app nativo enquanto você está fora

Sessão autônoma. Objetivo: adiantar tudo do app nativo do motoboy que **não
depende do token da Expo** nem do Firebase. Mesmas regras da sessão noturna
(nunca Asaas produção / iFood; decidir sozinho no pequeno, documentar em
`DECISOES-NOTURNAS.md`, limpar dado de teste).

O **PWA `apps/motoboy` (produção) não foi tocado.** O app nativo
(`apps/motoboy-app`) é um cliente adicional do mesmo backend.

---

## 1. Ícone do app ✅

- Ícone novo na paleta do design system (**verde-pinho `#1f6f5c`**): um "L"
  terminando num pino de rota — lê como "Leeva" e como entrega/rota. Substitui
  o "A" azul com linhas de construção que veio do zip.
- Gerados todos os tamanhos que o Expo usa: `icon.png` (1024, sobre o verde),
  `adaptive-icon.png` (foreground, dentro da zona segura do Android),
  `android-icon-monochrome.png` (ícone temático), `splash-icon.png`,
  `favicon.png`.
- Aplicado no `app.config.js` (`icon`, `android.adaptiveIcon`,
  plugin `expo-splash-screen` com fundo `#141513`).

## 2. GPS em segundo plano ✅

- `src/lib/backgroundLocation.ts` — task do `expo-task-manager` +
  `Location.startLocationUpdatesAsync`. Enquanto **há entrega ativa**, o app
  continua enviando a posição para `POST /api/location` mesmo com a tela
  travada ou o app minimizado.
- **Notificação fixa obrigatória no Android** (foreground service):
  "Leeva — entrega em andamento · Enviando sua localização para o cliente
  acompanhar a entrega."
- Liga sozinho quando surge uma entrega ativa; **desliga sozinho** quando não
  há entrega, ao ficar offline, ou ao sair.
- O watch de primeiro plano agora só alimenta o mapa (não duplica o envio ao
  servidor — quem envia com entrega ativa é a task de segundo plano).
- Permissões adicionadas no `app.config.js`: `ACCESS_BACKGROUND_LOCATION`,
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `WAKE_LOCK`. Plugin
  `expo-location` com `isAndroidBackgroundLocationEnabled` +
  `isAndroidForegroundServiceEnabled`.
- Testes: `src/lib/__tests__/locationPayload.test.mjs` (3/3) — throttle,
  formato do payload, "pega a última leitura do lote".

## 3. Guia do Firebase, por escrito ✅

- **`apps/motoboy-app/FIREBASE-SETUP.md`** — passo a passo pra leigo: criar o
  projeto Firebase grátis, registrar o app Android com o pacote
  `br.com.leeva.motoboy`, baixar o `google-services.json`, onde exatamente
  colocar (`apps/motoboy-app/google-services.json`), e como ligar a chave FCM
  no EAS.
- **O código já reconhece o arquivo sozinho.** O `app.json` virou
  `app.config.js` (config dinâmica): ele checa se
  `google-services.json` / `GoogleService-Info.plist` existem e, se sim,
  injeta o `googleServicesFile` automaticamente — **sem mais nenhuma mudança
  de código depois que você colocar o arquivo.**
- `src/lib/push.ts` usa a flag `extra.firebaseConfigured` pra não tentar
  registrar push num build standalone que ainda não tem o Firebase (o app
  continua funcionando normal, só o push que fica dormindo até o arquivo entrar).
- `.gitignore` reforçado: `google-services.json`, `GoogleService-Info.plist` e
  qualquer `*-service-account*.json` / `firebase-adminsdk*.json` nunca sobem
  pro GitHub.

## 4. Pronto pro build (sem executar) ✅

- **`eas.json`** com 3 perfis:
  - `development` — APK com dev client (testar GPS/push num aparelho).
  - `preview` — APK pra instalar direto (mandar pros motoboys testarem).
  - `production` — AAB pra Play Store, com `autoIncrement` da versão.
  - Cada perfil já traz `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_SUPABASE_URL`.
- **`apps/motoboy-app/PRONTO-PARA-BUILD.md`** — a sequência exata de comandos
  pra quando você voltar: `eas login`, `eas init`, criar o `.env` com a chave
  anon, testar no celular com **Expo Go** (`npx expo start`), e os
  `eas build --profile preview/production`. Com um checklist e uma seção
  "se der errado".
- `app.config.js` lê o Project ID de `process.env.EAS_PROJECT_ID` (ou você
  cola direto no arquivo depois do `eas init`).

## 5. Pendências menores da sessão anterior

### a) "Agrupado com X e Y" na tela do restaurante ✅

- Pedido em rota agrupada agora mostra uma tag **"rota agrupada · 2ª de 3"** no
  card, e no detalhe uma seção **"Rota agrupada"** listando as paradas
  (`1ª parada — #123 (João)`, etc.), explicando por que o custo saiu menor que
  o de uma entrega avulsa.
- `apps/restaurante/app/(app)/pedidos/page.tsx` monta o mapa
  `group_id → paradas`; `OrdersBoard` e `OrderDetail` só exibem.

### b) Refino visual das telas secundárias ✅ (pass principal)

- As linhas de indicadores (`.stat-row`) viraram **um cartão só com divisórias
  finas** entre os números, no lugar de "vários cartões iguais com a mesma
  borda". Mudança de CSS → melhora **todas** as telas de uma vez: Visão geral,
  Financeiro, Unit economics, Entregadores, Repasses, detalhe do restaurante
  (admin) e Indicadores/Financeiro (restaurante). Conferido no navegador.
- O restante (formulários de config longos) segue como refino incremental —
  não há mais mudança de base necessária.

### c) "Pedido chegando" por proximidade GPS ✅ (já existia — verificado)

- `recordDriverLocation` **já** detecta o motoboy a < 400 m do destino de uma
  entrega `in_route` e dispara `delivery.nearby` → notificação
  `customer.nearby` ("Seu pedido está chegando"), idempotente (não duplica).
  Estava implementado desde a Fase 2 mas listado como pendente por engano.
- Teste novo em `scripts/test-tracking.mjs` cobrindo o fluxo (8/8).

---

## Testes

| Suíte | Resultado |
|---|---|
| unitários (`npm test`) | 34 / 34 |
| app nativo (`cd apps/motoboy-app && npm test`) | 3 / 3 |
| fase3 · fase35 · fase4 · fase5 · fase5c | 14 · 21 · 18 · 16 · 6 |
| tracking (com o teste novo de proximidade) | 8 / 8 |
| integração · concorrência | 14 · 7 |

Typecheck e lint dos 3 apps web + do app nativo: sem erro.
`expo-doctor`: 21/21. Bundle Android do app nativo: gera sem erro.
As suítes `fase3` e `fase5c` às vezes falham 1 caso quando rodadas em
sequência (flakiness antiga de timing do despacho, banco compartilhado) —
passam 100% rodadas sozinhas.

## Decisões novas tomadas sozinho

Todas registradas em `docs/DECISOES-NOTURNAS.md` (seção nova "App nativo —
ícone, GPS em segundo plano, preparação de build"). Resumo:

1. **`app.json` → `app.config.js`** (config dinâmica) para o app reconhecer o
   Firebase sozinho. Mudança pequena, reversível, e é o jeito padrão do Expo
   pra isso.
2. **Task de segundo plano é a única que envia localização quando há entrega
   ativa** (o watch de primeiro plano só desenha o mapa) — evita envio duplicado.
3. **Ícone: "L" + pino de rota.** Não copia o chevron "A" do zip; usa a cor de
   marca; funciona pequeno.
4. **Indicadores consolidados via CSS** (`.stat-row` = um cartão dividido) em
   vez de refazer cada tela — mesma melhora, risco quase zero.
5. **`eas.json` já com as env não-secretas embutidas** (API_URL, SUPABASE_URL);
   a chave anon fica no `.env` local que o EAS lê (não no repo).

## O que fica esperando você

| Espera | O quê |
|---|---|
| **Token Expo** | `eas login` → `eas init` → `eas build`. Tudo em `PRONTO-PARA-BUILD.md`. |
| **Conta Firebase** (grátis) | baixar `google-services.json`, pôr na pasta, `eas credentials`. Tudo em `FIREBASE-SETUP.md`. O código já está pronto. |
| **Conta Google Play** (US$ 25) | só quando for publicar na loja. |
| **Testar num aparelho** | o essencial (login, ficar online, receber oferta, entrega, GPS em segundo plano, notificação) só dá pra validar de verdade num APK/dev build. |

## Dados de teste

Limpos (`scripts/cleanup-night.mjs`). Banco: só a demonstração permanente —
1 restaurante (`dono@leeva.dev` / `leeva123`), 12 motoboys demo offline,
0 pedidos, 0 push subscriptions.
