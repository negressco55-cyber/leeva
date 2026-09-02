# Sentry — ligar o monitoramento de erros

**O que é:** o Sentry avisa você quando algo quebra em produção (uma tela que
deu erro pro restaurante, uma rota de API que falhou), com o stack trace e o
contexto. Hoje os erros vão só pra tabela `error_events` (visível no admin) e
pro log da Vercel — o Sentry junta tudo num painel, com alerta por e-mail.

**Estado atual:** o SDK **já está instalado** nos apps `restaurante` e `admin`
(`@sentry/nextjs`), com toda a fiação pronta. Enquanto as variáveis de
ambiente estiverem vazias, ele **não faz nada** (zero impacto). Você só precisa
criar a conta e preencher 2 variáveis — **sem nenhuma mudança de código.**

> O `apps/motoboy` (PWA em produção) **não** recebeu o SDK ainda — decisão de
> não mexer nele enquanto você estava fora. A receita pra adicionar é a mesma
> (final deste arquivo).

---

## 1. Criar a conta (grátis)

1. Entre em **https://sentry.io/signup/** — pode entrar com GitHub/Google.
2. Plano: **Developer (grátis)** — 5.000 erros/mês, 1 usuário. Dá e sobra pro
   começo.
3. Quando pedir "What do you want to monitor?", escolha **Next.js**.
4. Ele cria uma **organização** (ex.: `leeva`) e um **projeto** (ex.:
   `leeva-restaurante`). Crie **dois projetos**: um `leeva-restaurante` e um
   `leeva-admin` (Settings → Projects → Create Project → Next.js).

## 2. Pegar o DSN de cada projeto

Em cada projeto: **Settings → Client Keys (DSN)** → copie o valor **DSN**.
Parece com:

```
https://abc123...@o123456.ingest.us.sentry.io/7890123
```

## 3. Colar na Vercel

No painel da Vercel, para **cada** projeto (`leeva-restaurante` e `leeva-admin`),
em **Settings → Environment Variables**, adicione (target: Production):

| Nome | Valor |
|---|---|
| `SENTRY_DSN` | o DSN do projeto Sentry correspondente |
| `NEXT_PUBLIC_SENTRY_DSN` | **o mesmo DSN** (é o que o navegador usa) |

Depois **redeploy** (Deployments → ... → Redeploy) ou só faça um push qualquer.
Pronto — a partir daí, erro em produção aparece no painel do Sentry.

## 4. (Opcional) Stack traces legíveis — "source maps"

Sem isto, o erro no Sentry aparece com o código "minificado" (difícil de ler).
Pra corrigir:

1. No Sentry: **Settings → Auth Tokens → Create New Token**, com o escopo
   **`project:releases`** (e `org:read`). Copie o token.
2. Na Vercel, nos dois projetos, adicione:

   | Nome | Valor |
   |---|---|
   | `SENTRY_AUTH_TOKEN` | o token criado |
   | `SENTRY_ORG` | o slug da sua org (ex.: `leeva`) |
   | `SENTRY_PROJECT` | `leeva-restaurante` / `leeva-admin` (por projeto) |

3. Redeploy. O build passa a subir os source maps automaticamente.

> Sem o `SENTRY_AUTH_TOKEN` o build ignora essa etapa (não quebra).

---

## Como isso está montado no código (referência)

- `packages/shared/src/services/observability.ts` — `captureError()` é o ponto
  único; ele já chama `sentry?.captureException()`. `registerErrorReporter()`
  liga o SDK nesse ponto.
- `apps/{restaurante,admin}/instrumentation.ts` — carrega o config do runtime
  certo (server/edge).
- `apps/{restaurante,admin}/sentry.server.config.ts` — `Sentry.init` +
  `registerErrorReporter` (só se `SENTRY_DSN` existir).
- `apps/{restaurante,admin}/sentry.edge.config.ts` — idem, runtime edge.
- `apps/{restaurante,admin}/instrumentation-client.ts` — `Sentry.init` do
  navegador (só se `NEXT_PUBLIC_SENTRY_DSN` existir).
- `apps/{restaurante,admin}/app/global-error.tsx` — captura erro de render do
  React (tela branca) e mostra uma tela de "algo deu errado / recarregar".
- `apps/{restaurante,admin}/next.config.mjs` — `withSentryConfig(...)` (só faz
  upload de source map quando há `SENTRY_AUTH_TOKEN`).

## Adicionar ao app do motoboy (PWA) quando quiser

Na pasta `apps/motoboy`:

```bash
npm install --workspace @leeva/motoboy @sentry/nextjs@^10
```

Depois copie os 5 arquivos do `apps/restaurante` (`instrumentation.ts`,
`instrumentation-client.ts`, `sentry.server.config.ts`,
`sentry.edge.config.ts`, `app/global-error.tsx`) e aplique o mesmo
`withSentryConfig` no `next.config.mjs`. Crie um 3º projeto Sentry
(`leeva-motoboy`) e adicione as vars na Vercel do projeto `leeva-motoboy`.
