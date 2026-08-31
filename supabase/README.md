# Banco de dados (Supabase)

## Migrations (nesta ordem)

| Arquivo | O que faz |
| --- | --- |
| `migrations/0001_init.sql` | Enums, tabelas (`restaurants`, `users`, `motoboys`, `orders`, `order_status_history`), triggers (updated_at, log de status, criação de `users` no signup) e funções helper de RLS. |
| `migrations/0002_rls.sql` | Liga o Row Level Security e cria todas as políticas por role (multi-tenant + motoboy só vê o que é dele). |
| `migrations/0003_realtime.sql` | Publica `orders` e `motoboys` no Realtime. |

## Como aplicar

### Opção A — Supabase na nuvem (recomendado para começar)

1. Crie um projeto em <https://supabase.com>.
2. No painel: **SQL Editor** → cole o conteúdo de cada arquivo `0001`, `0002`, `0003` (nessa ordem) → **Run**.
3. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (secreto!)
4. Em **Authentication → Providers → Email**: deixe "Confirm email" **desligado** para facilitar os testes.

### Opção B — Supabase local (precisa de Docker + CLI)

```bash
npm i -g supabase
supabase start
supabase db reset   # aplica todas as migrations de /supabase/migrations
```

As chaves locais aparecem no output do `supabase start`.

## Seed de teste

Depois de configurar o `.env.local` do app `restaurante`:

```bash
node --env-file=apps/restaurante/.env.local scripts/seed.mjs
```

Cria restaurante demo, um dono (`dono@leeva.dev` / `leeva123`) e um motoboy
(`motoboy@leeva.dev` / `leeva123`), além de 2 pedidos.

## Gerar os tipos TypeScript a partir do banco

```bash
# local:
supabase gen types typescript --local > packages/shared/src/types/database.ts
# nuvem:
supabase gen types typescript --project-id SEU_PROJECT_ID > packages/shared/src/types/database.ts
```
