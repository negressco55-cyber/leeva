# Deploy — produção (Fase 3.5)

Três apps Next.js + um banco Supabase. Recomendado: **Vercel** (um projeto por app)
+ **Supabase Cloud**. Tudo abaixo é barato/free-tier no início.

| App | Porta local | Domínio sugerido |
|---|---|---|
| `apps/restaurante` | 3000 | `app.seudominio.com` |
| `apps/motoboy` | 3001 | `entregador.seudominio.com` |
| `apps/admin` | 3002 | `admin.seudominio.com` (acesso restrito) |

## 1. Supabase

1. Projeto em supabase.com (região mais perto dos clientes — `sa-east-1` p/ Brasil).
2. **SQL Editor** → rodar as migrations de `supabase/migrations/` em ordem (`0001` → `0018`).
3. **Settings → API**: copiar `Project URL`, `anon`, `service_role`.
4. **Auth → Providers → Email**: "Confirm email" **desligado** (ou configurar SMTP).
5. **Backups**: plano Pro do Supabase = PITR (point-in-time recovery). No free-tier,
   agendar `pg_dump` externo (ver §6).

## 2. Variáveis de ambiente (por app na Vercel)

Comuns aos três:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...            # SECRETO
NEXT_PUBLIC_APP_URL=https://<dominio-do-app>
NEXT_PUBLIC_LEEVA_AUTH_COOKIE=sb-leeva-<app>   # -restaurante | -motoboy | -admin
```

Só `apps/restaurante`:

```
CRON_SECRET=<string aleatória forte>     # protege /api/cron/*
OSRM_BASE_URL=                           # opcional — rota real
MAPBOX_TOKEN=                            # opcional — tiles Mapbox
ANTHROPIC_API_KEY=                       # opcional — IA WhatsApp
SENTRY_DSN=                              # opcional — monitoramento (§5)
# credenciais de integração (iFood/WhatsApp/Twilio/VAPID) — ver docs/INTEGRATIONS.md
```

Só `apps/admin`:

```
LEEVA_EXTERNAL_COSTS=0                   # custo externo mensal estimado p/ o financeiro
```

Na Vercel: **Project Settings → Environment Variables**. `SUPABASE_SERVICE_ROLE_KEY`
e `CRON_SECRET` marcados como *Sensitive*.

## 3. Deploy dos apps

Monorepo Turborepo. Um projeto Vercel por app:

- **Root Directory**: `apps/restaurante` (idem para os outros)
- **Build Command**: `cd ../.. && npx turbo run build --filter=@leeva/restaurante`
- **Install Command**: `npm install` (na raiz)
- **Output**: `apps/restaurante/.next` (padrão detectado)

## 4. CRON REAL DO DESPACHO (obrigatório)

O motor de despacho precisa rodar a cada ~30 s mesmo sem ninguém acessar o painel.
Opção recomendada: **pg_cron + pg_net no próprio Supabase** (sem serviço externo).

Depois do deploy de `apps/restaurante`, rode UMA vez no **SQL Editor**:

```sql
select public.configure_dispatch_cron(
  'https://app.seudominio.com/api/cron/dispatch-tick',  -- URL pública do endpoint
  'MESMO-VALOR-DE-CRON_SECRET',                          -- igual ao env da Vercel
  '30 seconds'
);
```

Isso guarda URL+segredo no **Vault** e agenda o job `leeva-dispatch-tick`.
Verificar:

```sql
select jobname, schedule, active from cron.job;
select * from public.dispatch_runs order by started_at desc limit 10;
```

`dispatch_runs` mostra cada execução (ofertas feitas, expiradas, falhas, `skipped`
quando o lease estava ocupado — comportamento esperado sob concorrência).

**Alternativas** (se não quiser pg_cron):

- **Vercel Cron** (`vercel.json`): granularidade mínima de 1 min no plano Hobby.
  Aceitável, mas mais lento para reofertar. Exemplo:
  ```json
  { "crons": [{ "path": "/api/cron/dispatch-tick", "schedule": "* * * * *" }] }
  ```
  (o endpoint continua exigindo `x-cron-secret` — configure o header no cron ou
  use um proxy; a Vercel injeta `Authorization: Bearer $CRON_SECRET` — adapte o
  handler se optar por esse caminho).
- **GitHub Actions**: `schedule: '*/5 * * * *'` (mínimo ~5 min) chamando o endpoint
  com `curl -H "x-cron-secret: ..."`.

O endpoint é **idempotente** (LEASE com TTL de ~20 s + operações CAS): rodar de
vários lugares ao mesmo tempo é seguro — a execução extra é ignorada.

## 5. Monitoramento

`captureError()` (`@leeva/shared/services/observability`) já é o ponto único de
captura. Hoje grava em `error_events` (visível em Admin). Para Sentry:

1. `npm i @sentry/nextjs -w @leeva/restaurante`
2. `npx @sentry/wizard@latest -i nextjs` dentro de `apps/restaurante`
3. No bootstrap, `registerErrorReporter(Sentry)` — `captureError` passa a enviar.
4. `SENTRY_DSN` nas envs.

Nunca enviar telefone/endereço/chave/payload — `captureError` já sanitiza `detail`.

## 6. Backups

- Supabase Pro: ativar **PITR**.
- Free-tier: GitHub Action diária com `pg_dump` para um bucket (S3/R2):
  ```
  pg_dump "$SUPABASE_DB_URL" --no-owner --format=custom > leeva-$(date +%F).dump
  ```
- Guardar as migrations no git (fonte da verdade do schema).

## 7. Rate limiting

Já implementado (janela deslizante em `rate_limit_hits`, função `rate_limit_check`).
Cobre `/api/v1/deliveries`, `/api/integrations/orders`, `/api/track`, `/api/webhooks`,
`/api/geocode`, `/api/cron/dispatch-tick`. Limites em
`@leeva/shared/services/ratelimit` (`RATE_LIMITS`). Para escala muito alta, trocar
a implementação por Upstash/Redis mantendo a assinatura `checkRateLimit`.

## 8. Domínios / DNS

- CNAME de cada subdomínio → Vercel.
- Cookies de sessão já são separados por app (`NEXT_PUBLIC_LEEVA_AUTH_COOKIE`),
  então subdomínios distintos não conflitam.
- `admin.` — considerar proteção extra (Vercel Password, IP allowlist, ou
  Cloudflare Access). O acesso já exige linha em `platform_admins`.

Ver `docs/GO-LIVE.md` para o checklist final.
