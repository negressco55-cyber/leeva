-- =========================================================
-- LEEVA — FASE 3.5 — Admin da plataforma + cron real + observabilidade
--
-- - platform_admins: operadores da plataforma Leeva (acesso ao painel admin).
--   NÃO são usuários de restaurante nem motoboys.
-- - dispatch_runs: log de cada execução do motor de despacho (cron/nudge).
-- - locks via advisory lock para o cron não processar em duplicidade.
-- - rate_limit_hits: janela deslizante para proteção de endpoints.
-- - error_events: base para monitoramento (Sentry plugável depois).
-- - pg_cron + pg_net: execução periódica real do despacho.
-- =========================================================

-- ---------------------------------------------------------
-- PLATFORM ADMINS
-- ---------------------------------------------------------
create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- helper: o usuário logado é admin da plataforma?
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and active
  );
$$;

-- ---------------------------------------------------------
-- DISPATCH RUNS (observabilidade do motor)
-- ---------------------------------------------------------
create table public.dispatch_runs (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'cron',   -- 'cron' | 'nudge' | 'manual' | 'event'
  restaurant_id uuid references public.restaurants(id) on delete set null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  duration_ms   integer,
  offered       integer not null default 0,
  expired       integer not null default 0,
  failed        integer not null default 0,
  skipped       boolean not null default false,  -- lock ocupado (outra execução em curso)
  error         text
);
create index dispatch_runs_started_idx on public.dispatch_runs(started_at desc);

-- ---------------------------------------------------------
-- ADVISORY LOCK — impede duas execuções simultâneas do cron
-- (runDispatchTick já é CAS/idempotente; isto é defesa em profundidade
--  e evita trabalho desperdiçado + corrida na seleção de candidato).
-- ---------------------------------------------------------
create or replace function public.try_lock(key text)
returns boolean language sql volatile as $$
  select pg_try_advisory_lock(hashtext(key));
$$;

create or replace function public.release_lock(key text)
returns boolean language sql volatile as $$
  select pg_advisory_unlock(hashtext(key));
$$;

-- ---------------------------------------------------------
-- RATE LIMITING — janela deslizante por chave
-- Funciona em ambiente serverless (estado no banco, não em memória).
-- ---------------------------------------------------------
create table public.rate_limit_hits (
  bucket        text not null,        -- ex: 'deliveries:<restaurant_id>' | 'track:<ip>'
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (bucket, window_start)
);
create index rate_limit_hits_window_idx on public.rate_limit_hits(window_start);

-- incrementa e devolve o total na janela atual; TRUE se dentro do limite
create or replace function public.rate_limit_check(
  p_bucket text, p_limit integer, p_window_seconds integer
) returns table (allowed boolean, current_count integer, retry_after integer)
language plpgsql volatile security definer set search_path = public as $$
declare
  w_start timestamptz;
  c integer;
begin
  w_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limit_hits (bucket, window_start, count)
  values (p_bucket, w_start, 1)
  on conflict (bucket, window_start)
  do update set count = public.rate_limit_hits.count + 1
  returning count into c;

  -- limpeza leve e oportunista de janelas antigas
  delete from public.rate_limit_hits
  where window_start < now() - interval '1 hour'
    and random() < 0.02;

  return query select
    c <= p_limit,
    c,
    case when c <= p_limit then 0
         else greatest(1, ceil(extract(epoch from (w_start + make_interval(secs => p_window_seconds)) - now()))::int)
    end;
end $$;

-- ---------------------------------------------------------
-- ERROR EVENTS — base de monitoramento (Sentry/observabilidade plugável)
-- ---------------------------------------------------------
create table public.error_events (
  id           uuid primary key default gen_random_uuid(),
  scope        text not null,           -- 'api' | 'dispatch' | 'webhook' | 'integration' | 'billing' | 'db'
  message      text not null,
  detail       jsonb not null default '{}'::jsonb,   -- NUNCA dados sensíveis
  restaurant_id uuid references public.restaurants(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index error_events_created_idx on public.error_events(created_at desc);
create index error_events_scope_idx on public.error_events(scope, created_at desc);

-- ---------------------------------------------------------
-- CRON REAL — pg_cron + pg_net
-- ---------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Dispara o tick de despacho fazendo POST no endpoint da aplicação.
-- A URL e o segredo ficam no Vault (nunca hardcoded na migration).
create or replace function public.trigger_dispatch_tick()
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'leeva_cron_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'leeva_cron_secret';
  if v_url is null or v_secret is null then
    return;  -- ainda não configurado (ver docs/DEPLOY.md)
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
    body    := jsonb_build_object('source','pg_cron'),
    timeout_milliseconds := 20000  -- partida a frio do endpoint pode passar de 5s
  );
end $$;

-- Configuração one-shot do cron (rodar UMA vez em produção — ver docs/DEPLOY.md):
--   select public.configure_dispatch_cron(
--     'https://SEU-APP.vercel.app/api/cron/dispatch-tick',
--     'MESMO-VALOR-DE-CRON_SECRET',
--     '30 seconds');
create or replace function public.configure_dispatch_cron(
  p_target_url text, p_secret text, p_schedule text default '30 seconds'
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  jid bigint;
begin
  -- guarda/atualiza segredos no Vault (remove e recria = idempotente)
  delete from vault.secrets where name in ('leeva_cron_url','leeva_cron_secret');
  perform vault.create_secret(p_target_url, 'leeva_cron_url', 'URL do endpoint /api/cron/dispatch-tick');
  perform vault.create_secret(p_secret, 'leeva_cron_secret', 'valor de CRON_SECRET da aplicação');

  -- (re)agenda
  if exists (select 1 from cron.job where jobname = 'leeva-dispatch-tick') then
    perform cron.unschedule('leeva-dispatch-tick');
  end if;
  select cron.schedule('leeva-dispatch-tick', p_schedule, 'select public.trigger_dispatch_tick()') into jid;
  return 'agendado job ' || jid || ' (' || p_schedule || ')';
end $$;

comment on function public.configure_dispatch_cron is
  'Rodar UMA vez em produção com a URL pública do endpoint /api/cron/dispatch-tick e o CRON_SECRET.';
