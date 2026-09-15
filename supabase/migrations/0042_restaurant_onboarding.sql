-- =========================================================
-- LEEVA — completar cadastro do restaurante
-- =========================================================
-- 1) Horário de funcionamento — bloqueia despacho/pedido fora do expediente.
-- 2) Termos de uso do restaurante — reaproveita terms_versions (Fase 5),
--    agora com coluna "audience" pra separar termos de motoboy e de
--    restaurante (mesmo pool de números de versão, filtrado por audience).
-- 3) Volume esperado de pedidos — só informativo, pro admin ver.

-- ---------------------------------------------------------
-- 1) HORÁRIO DE FUNCIONAMENTO
-- ---------------------------------------------------------
-- Um horário simples por dia da semana (sem múltiplos turnos nesta versão):
-- { "mon": {"open":"08:00","close":"22:00","closed":false}, "tue": {...}, ... }
alter table public.restaurants
  add column if not exists business_hours jsonb;

-- ---------------------------------------------------------
-- 2) TERMOS DE USO DO RESTAURANTE
-- ---------------------------------------------------------
alter table public.terms_versions
  add column if not exists audience text not null default 'motoboy';
do $$ begin
  alter table public.terms_versions
    add constraint terms_versions_audience_check check (audience in ('motoboy', 'restaurant'));
exception when duplicate_object then null;
end $$;

alter table public.restaurants
  add column if not exists terms_accepted_version integer;

-- termos de restaurante v1 — texto placeholder, mesmo padrão do motoboy.
insert into public.terms_versions (version, content, audience)
select coalesce((select max(version) from public.terms_versions), 0) + 1,
       '[TEXTO PROVISÓRIO — substituir pelo texto jurídico definitivo antes de produção real]',
       'restaurant'
where not exists (select 1 from public.terms_versions where audience = 'restaurant');

create table if not exists public.restaurant_terms_acceptance (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  terms_version integer not null references public.terms_versions(version),
  accepted_at   timestamptz not null default now(),
  ip            text,
  unique (restaurant_id, terms_version)
);
create index if not exists restaurant_terms_acceptance_restaurant_idx
  on public.restaurant_terms_acceptance(restaurant_id);

alter table public.restaurant_terms_acceptance enable row level security;
drop policy if exists "restaurant_terms_acceptance: admin lê todos" on public.restaurant_terms_acceptance;
create policy "restaurant_terms_acceptance: admin lê todos" on public.restaurant_terms_acceptance
  for select using (public.is_platform_admin());
-- leitura/escrita do próprio restaurante e demais gravações passam pelo
-- servidor (service_role) — sem policy extra de escrita pro client.

-- ---------------------------------------------------------
-- 3) VOLUME ESPERADO DE PEDIDOS (informativo, só pro admin)
-- ---------------------------------------------------------
alter table public.restaurants
  add column if not exists expected_daily_orders integer;
