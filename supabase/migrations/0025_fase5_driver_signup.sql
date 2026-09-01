-- =========================================================
-- LEEVA — FASE 5 (Bloco A) — Cadastro self-service + aprovação + termos
--
-- O restaurante NÃO cadastra mais motoboy. Todo motoboy entra pelo
-- self-service e vira rede Leeva (fleet='leeva', restaurant_id=null).
-- O cadastro nasce 'pending_approval' e só a plataforma (admin) aprova.
-- Antes de ficar online a 1ª vez, precisa aceitar os termos (placeholder
-- jurídico por enquanto).
-- =========================================================

create type driver_approval_status as enum ('pending_approval', 'approved', 'rejected');

alter table public.motoboys
  add column approval_status         driver_approval_status not null default 'approved',  -- os existentes já valem
  add column approval_reason         text,
  add column approved_by             uuid references auth.users(id) on delete set null,
  add column approved_at             timestamptz,
  add column cpf                     text,
  add column city                    text,
  add column personal_doc_path       text,   -- storage: driver-documents/{motoboy_id}/personal.*
  add column vehicle_doc_path        text,   -- storage: driver-documents/{motoboy_id}/vehicle.*
  add column signup_source           text not null default 'restaurant',  -- 'restaurant' | 'self_service'
  add column terms_accepted_version  integer;  -- versão dos termos que o motoboy aceitou (null = nunca aceitou)

-- grandfathering: motoboys que já existiam entram já aprovados e com os
-- termos v1 aceitos (não travar quem já operava).
update public.motoboys set terms_accepted_version = 1 where approval_status = 'approved';

create unique index motoboys_cpf_idx on public.motoboys(cpf) where cpf is not null;
create unique index motoboys_phone_self_idx on public.motoboys(phone) where signup_source = 'self_service';
create index motoboys_approval_idx on public.motoboys(approval_status) where approval_status = 'pending_approval';

-- ---------------------------------------------------------
-- TERMOS DE USO (encaixe técnico — o texto vem do advogado)
-- ---------------------------------------------------------
create table public.terms_versions (
  id           uuid primary key default gen_random_uuid(),
  version      integer not null unique,
  content      text not null,
  published_at timestamptz not null default now(),
  active       boolean not null default true
);
insert into public.terms_versions (version, content) values
  (1, '[TEXTO DOS TERMOS DE USO A SER DEFINIDO PELO ADVOGADO — versão provisória, não usar em produção real ainda]');

create table public.driver_terms_acceptance (
  id            uuid primary key default gen_random_uuid(),
  motoboy_id    uuid not null references public.motoboys(id) on delete cascade,
  terms_version integer not null references public.terms_versions(version),
  accepted_at   timestamptz not null default now(),
  ip            text,
  unique (motoboy_id, terms_version)
);
create index driver_terms_acceptance_motoboy_idx on public.driver_terms_acceptance(motoboy_id);

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table public.terms_versions          enable row level security;
alter table public.driver_terms_acceptance enable row level security;

create policy "terms_versions: autenticado lê as ativas" on public.terms_versions
  for select using (auth.uid() is not null and active);

create policy "driver_terms_acceptance: motoboy lê o próprio" on public.driver_terms_acceptance
  for select using (motoboy_id = public.current_motoboy_id());
create policy "driver_terms_acceptance: admin lê todos" on public.driver_terms_acceptance
  for select using (public.is_platform_admin());

-- admin já lê motoboys (policy "motoboys: admin lê todos"); admin precisa PODER
-- aprovar/rejeitar — a escrita é feita pelo servidor (service_role), não pelo client.

-- ---------------------------------------------------------
-- STORAGE — bucket privado para os documentos
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('driver-documents', 'driver-documents', false)
  on conflict (id) do nothing;

create policy "driver-docs: motoboy gerencia a própria pasta"
  on storage.objects for all
  using (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = (select m.id::text from public.motoboys m where m.user_id = auth.uid())
  )
  with check (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = (select m.id::text from public.motoboys m where m.user_id = auth.uid())
  );

create policy "driver-docs: admin lê tudo"
  on storage.objects for select
  using (bucket_id = 'driver-documents' and public.is_platform_admin());
