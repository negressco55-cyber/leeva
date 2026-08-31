-- =========================================================
-- LEEVA — FASE 3.5 — Lease de execução do despacho
--
-- Advisory lock de sessão não sobrevive entre chamadas PostgREST (cada
-- chamada é uma conexão do pool). Usamos um LEASE com TTL numa linha única:
-- se a última execução foi há menos de `ttl`, a nova é ignorada.
-- Correto em ambiente serverless.
-- =========================================================

create table if not exists public.dispatch_lock (
  id          integer primary key default 1,
  leased_at   timestamptz not null default 'epoch',
  constraint dispatch_lock_singleton check (id = 1)
);
insert into public.dispatch_lock (id) values (1) on conflict do nothing;

alter table public.dispatch_lock enable row level security;
-- sem policies: só service_role

-- tenta adquirir o lease; TRUE => pode processar
create or replace function public.acquire_dispatch_lease(ttl_seconds integer default 25)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  ok boolean;
begin
  update public.dispatch_lock
     set leased_at = now()
   where id = 1
     and leased_at < now() - make_interval(secs => ttl_seconds)
  returning true into ok;
  return coalesce(ok, false);
end $$;

-- libera explicitamente (opcional — o TTL já garante progresso)
create or replace function public.release_dispatch_lease()
returns void language sql volatile security definer set search_path = public as $$
  update public.dispatch_lock set leased_at = 'epoch' where id = 1;
$$;
