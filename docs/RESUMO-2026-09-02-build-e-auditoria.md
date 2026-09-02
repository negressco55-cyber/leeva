# Resumo — 02/09/2026 · Build do APK, Sentry, auditoria

Sessão autônoma ("vou dormir, faça tudo sozinho"). Mesmas regras de sempre
(sem Asaas produção / iFood; decidir sozinho no pequeno e documentar; limpar
dado de teste; **não mexer no `apps/motoboy` PWA de produção**).

Prioridade dada: Parte 1 (build) e Parte 4 (auditoria) acima das demais.

---

## Parte 1 — App nativo: corrigir e buildar ✅

### O erro de config

`Slug ... (leeva) does not match the slug field (leeva-motoboy)` — o projeto
EAS que você criou (`5c851aad-...`) na verdade se chama **`leeva`** (org
`leeva-jp`), não `leeva-motoboy`. Corrigido no `app.config.js`:
`slug: 'leeva'` + `owner: 'leeva-jp'`.

O aviso "eas env:create is deprecated" — o comando novo é **`eas env:set`**.
Atualizei o `PRONTO-PARA-BUILD.md`.

### Variável de ambiente

`EXPO_PUBLIC_SUPABASE_ANON_KEY` (lida do `apps/restaurante/.env.local`, é a
chave pública) setada no ambiente **preview** da Expo via
`eas env:set --visibility sensitive`. A `EXPO_PUBLIC_API_URL` e a
`EXPO_PUBLIC_SUPABASE_URL` já vinham do `eas.json`.

### Build

`eas build --profile preview --platform android --non-interactive` rodou na
nuvem da Expo (~12 min, keystore gerado automaticamente). **Terminou com
sucesso.**

**APK: https://expo.dev/artifacts/eas/5V5aVb_6NxpUbkAUNCa0ZkgFRDeo0URObuFIse4Vel0.apk**

- Build ID `0a60cb60-25a5-4d24-b0ca-0f55bece8bff`, versão 1.0.0.
- Página com QR code: https://expo.dev/accounts/leeva-jp/projects/leeva/builds/0a60cb60-25a5-4d24-b0ca-0f55bece8bff
- Link + guia de instalação salvos no topo de `apps/motoboy-app/PRONTO-PARA-BUILD.md`.

**Como instalar** (resumo): abrir o link no navegador do celular Android →
baixar o `.apk` → permitir "instalar apps desta fonte" → Instalar. Push ainda
não funciona (falta Firebase); o resto sim.

---

## Parte 2 — Sentry ✅ (código pronto, conta pendente)

- `@sentry/nextjs@^10` instalado em **`restaurante` e `admin`**.
- Arquivos padrão: `instrumentation.ts`, `sentry.server.config.ts`,
  `sentry.edge.config.ts`, `instrumentation-client.ts`, `app/global-error.tsx`,
  e `withSentryConfig()` no `next.config.mjs`.
- **Tudo no-op** enquanto `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` estiverem
  vazios. `registerErrorReporter` (que já existia em `observability.ts`) é
  ligado no `sentry.server.config.ts`.
- Builds de produção de restaurante + admin: **passam** (testei localmente).
- `docs/SENTRY-SETUP.md` — passo a passo pra criar a conta grátis, pegar o DSN
  e colar na Vercel. Sem mudança de código depois.

**Decisão tomada sozinho:** *não* adicionei o SDK no `apps/motoboy` (PWA),
apesar da Parte 2 dizer "3 apps web". Motivo: a regra "não mexer no PWA de
produção" aparece no mesmo prompt e vale como absoluta; o Sentry é no-op sem
DSN de qualquer jeito, então não perco nada esperando você acordar. A receita
pra adicionar (idêntica) está no fim do `SENTRY-SETUP.md`.

**Por que precisou do `withSentryConfig`:** tentei um setup "manual" mais
enxuto primeiro, mas o `@sentry/nextjs` puxa módulos de Node (`http`, `net`)
pro bundle do runtime edge e quebra o build. O `withSentryConfig` é o que
resolve o split server/edge/client — é o jeito oficial. Configurado pra **não**
fazer upload de source map sem `SENTRY_AUTH_TOKEN` (evita depender de token no
build).

---

## Parte 3 — `docs/PENDENCIAS-DE-CONTA.md` ✅

Passo a passo (sem executar nada) para:

1. **Confirmação de e-mail + SMTP** — como criar um SMTP grátis (Resend) e
   ligar no Supabase Auth. Aviso: ligar a confirmação sem o SMTP trava os
   cadastros.
2. **Backup** — o que o plano grátis dá (7 dias, sem self-restore), como fazer
   `pg_dump` manual agora, e como ativar PITR quando assinar o Supabase Pro.
3. **Proteção do admin** — 3 opções (Vercel Auth / Cloudflare Access / Basic
   Auth no middleware), com recomendação.
4. **Planos pagos** — quando subir pra Vercel Pro (obrigatório antes de cobrar,
   pelos termos) e Supabase Pro (junto com o 1º cliente), com os sinais de que
   passou do limite grátis.

---

## Parte 4 — Auditoria geral ✅ (nada crítico encontrado)

### Segurança

- **RLS:** as **35 tabelas** do schema `public` têm RLS ligada. Todas as
  políticas escopam por `current_restaurant_id()` / `current_motoboy_id()` /
  `is_platform_admin()`. As 2 tabelas com 0 políticas (`dispatch_lock`,
  `rate_limit_hits`) são internas — RLS ligada sem política = nega tudo (só o
  service_role acessa), que é o correto.
- **Rotas de API:** as 25 do restaurante, 15 do motoboy e 10 do admin — **todas**
  validam identidade e escopam a query. Confirmei nas mais sensíveis
  (`finance`, `map`, `heatmap`, `team`, `credits`, `orders/[id]`): sempre
  passam `ctx.restaurantId` / checam `orderBelongsTo` / têm gate de plano ou de
  role. `heatmap` bloqueia plano free; compra de crédito exige `restaurant_owner`.
- **Rastreamento público** (`/track/[token]`): snapshot já sanitizado — sem
  telefone de motoboy, sem valores de custo, sem id interno.
- **Segredos:** zero chave hardcoded no código ou nos scripts. Zero `.env`
  rastreado no git. O `scripts/apply-migration.mjs` lê o token do ambiente.

### Higiene de código

- **Zero `console.log`** de debug (só `console.error` / `console.warn`
  legítimos).
- **Zero `TODO` / `FIXME` / `HACK`** de verdade (os matches eram a palavra
  "TODOS" em português).
- **Lint + typecheck:** limpos nos 3 apps web **e** no app nativo.

### Design system

Confere com `docs/DESIGN-SYSTEM.md`:
- Zero `text-transform: uppercase` (o reset global zera, e não há uso explícito).
- Zero gradiente decorativo.
- `box-shadow` só onde o design permite (o anel de foco do input e o
  `--shadow-pop` do `.offer-card`/`.dialog`).
- Zero `→` em botão. Zero cor hex hardcoded em `style` inline (fora dos mapas,
  que precisam de cor viva sobre o tile).

### Corrigido

- **Botão "Entrar" do admin** estava com estilo secundário (branco) — era um
  `.btn` sem `.primary`. Agora `.btn.primary` (verde), consistente com os
  outros logins.

---

## Parte 5 — Backlog (o que deu tempo)

- **Testes do push nativo (Bloco B):** `test-fase5.mjs` +3 casos —
  `saveExpoPushToken` cria linha `kind='expo'` e liga `push_enabled`, token
  malformado é recusado, `sendPushToMotoboy` tenta o Expo Push Service sem
  lançar. fase5 agora **19/19**.
- Agrupamento (`test-fase5c`, 6) e rastreamento + proximidade (`test-tracking`,
  8) já estavam cobertos das sessões anteriores.
- GPS em segundo plano: a lógica pura (throttle / payload) tem 3 testes
  (`apps/motoboy-app/src/lib/__tests__`). O comportamento nativo (foreground
  service, permissão background) só valida num device — anotado.
- Refino visual mais amplo das telas secundárias: fica pra uma próxima — a base
  (KPIs consolidados) já foi feita na sessão anterior.

---

## Testes — tudo verde

| Suíte | Resultado |
|---|---|
| unitários (`npm test`) | 34 / 34 |
| app nativo (`apps/motoboy-app`) | 3 / 3 |
| fase3 · fase35 · fase4 · **fase5** · fase5c | 14 · 21 · 18 · **19** · 6 |
| tracking · integração · concorrência | 8 · 14 · 7 |
| **total** | **147 / 147** |

Typecheck + lint: limpos (3 apps web + nativo).
Build de produção: restaurante + admin passam **com Sentry**.
O PWA `apps/motoboy` **não foi tocado**.

## Dados de teste

Limpos (`scripts/cleanup-night.mjs`). Banco: só a demo permanente —
1 restaurante, 12 motoboys offline, 0 pedidos, 0 push subscriptions,
`terms_versions` só v1.

## O que precisa de você

| Item | O quê |
|---|---|
| **Testar o APK** | instalar no celular pelo link acima e rodar o checklist (login → online → mapa → GPS em segundo plano) |
| **Firebase** | `FIREBASE-SETUP.md` — pra o push funcionar no APK |
| **Sentry** | `SENTRY-SETUP.md` — criar conta grátis, colar 2 DSNs na Vercel |
| **Contas/planos** | `PENDENCIAS-DE-CONTA.md` — SMTP, Vercel Pro, Supabase Pro, proteção do admin |
