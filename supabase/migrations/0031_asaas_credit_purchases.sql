-- =========================================================
-- LEEVA — Asaas (Bloco 3) — compra de crédito via Pix real
-- =========================================================
-- O restaurante pede um pacote -> geramos uma cobrança Pix na Asaas ->
-- o restaurante paga -> a Asaas chama nosso webhook -> confirmamos e
-- liberamos o crédito. Uma linha por tentativa de compra.

create table if not exists public.credit_purchases (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  package_id     uuid references public.credit_packages(id),
  amount         numeric(10,2) not null,           -- crédito a liberar (sem bônus)
  bonus          numeric(10,2) not null default 0, -- bônus do pacote
  gross          numeric(10,2) not null,           -- valor cobrado no Pix
  status         text not null default 'pending'
                   check (status in ('pending','paid','failed','expired','refunded')),
  provider       text not null default 'asaas',
  external_id    text,                              -- id do payment na Asaas
  invoice_url    text,                              -- página de pagamento
  pix_copy_paste text,                              -- código copia-e-cola
  simulated      boolean not null default false,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  updated_at     timestamptz not null default now()
);

create index if not exists credit_purchases_restaurant_idx
  on public.credit_purchases(restaurant_id, created_at desc);

-- idempotência: um pagamento da Asaas confirma no máximo uma compra
create unique index if not exists credit_purchases_external_idx
  on public.credit_purchases(provider, external_id) where external_id is not null;

alter table public.credit_purchases enable row level security;

-- a equipe do restaurante vê as próprias tentativas de compra; admin vê todas.
create policy "credit_purchases: equipe lê as compras do restaurante"
  on public.credit_purchases for select
  using (restaurant_id = public.current_restaurant_id());
create policy "credit_purchases: admin lê todas"
  on public.credit_purchases for select
  using (public.is_platform_admin());
-- escrita só pelo service_role (webhook / API server-side).

-- o painel atualiza sozinho quando a compra muda de status
alter table public.credit_purchases replica identity full;
alter publication supabase_realtime add table public.credit_purchases;
