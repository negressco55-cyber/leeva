-- =========================================================
-- LEEVA — FASE 4 (Bloco 4) — Repasse ao motoboy
--
-- O motoboy recebe 100% do valor da entrega (orders.driver_payout).
-- Não precisa de conta em lugar nenhum — só cadastra a própria chave Pix.
-- Pagamento em LOTE (fechamento diário), não por entrega, via Pix comum.
--
-- Bloco 4: estrutura completa. A transferência de fato (Asaas) fica em
-- MODO SIMULAÇÃO até as credenciais serem configuradas (Bloco 3).
-- =========================================================

-- chave Pix do motoboy (sem conta Asaas)
alter table public.motoboys
  add column pix_key      text,
  add column pix_key_type text;  -- 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'

create type payout_batch_status as enum (
  'pending',          -- fechado, aguardando processamento
  'processing',       -- transferência em andamento
  'paid',             -- transferido com sucesso
  'failed',           -- falha na transferência (chave errada, saldo Asaas, etc.)
  'awaiting_pix'      -- motoboy sem chave Pix cadastrada
);

-- fechamento: 1 lote por motoboy por dia
create table public.payout_batches (
  id             uuid primary key default gen_random_uuid(),
  motoboy_id     uuid not null references public.motoboys(id) on delete cascade,
  period_date    date not null,
  amount         numeric(12,2) not null,
  earnings_count integer not null default 0,
  status         payout_batch_status not null default 'pending',
  pix_key        text,          -- snapshot da chave no fechamento
  pix_key_type   text,
  external_ref   text,          -- id da transferência (Asaas) ou 'SIMULADO'
  simulated      boolean not null default false,
  error          text,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  unique (motoboy_id, period_date)
);
create index payout_batches_status_idx on public.payout_batches(status, created_at desc);
create index payout_batches_motoboy_idx on public.payout_batches(motoboy_id, period_date desc);

-- ganho por entrega (fila de repasse) — 1 por entrega concluída
create table public.driver_earnings (
  id         uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references public.motoboys(id) on delete cascade,
  order_id   uuid not null references public.orders(id) on delete cascade,
  amount     numeric(10,2) not null,
  earned_at  timestamptz not null default now(),
  batch_id   uuid references public.payout_batches(id) on delete set null,  -- null = ainda não fechado
  unique (order_id)
);
create index driver_earnings_unbatched_idx on public.driver_earnings(motoboy_id) where batch_id is null;

-- ---------------------------------------------------------
-- trigger: ao concluir a entrega, registra o ganho do motoboy
-- ---------------------------------------------------------
create or replace function public.record_driver_earning()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'delivered' and old.status is distinct from 'delivered'
     and new.motoboy_id is not null and coalesce(new.driver_payout, 0) > 0 then
    insert into public.driver_earnings (motoboy_id, order_id, amount)
      values (new.motoboy_id, new.id, new.driver_payout)
    on conflict (order_id) do nothing;
  end if;
  return new;
end $$;

create trigger trg_orders_driver_earning
  after update on public.orders
  for each row execute function public.record_driver_earning();

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table public.payout_batches  enable row level security;
alter table public.driver_earnings enable row level security;

create policy "payout_batches: motoboy lê os próprios" on public.payout_batches
  for select using (motoboy_id = public.current_motoboy_id());
create policy "payout_batches: admin lê todos" on public.payout_batches
  for select using (public.is_platform_admin());

create policy "driver_earnings: motoboy lê os próprios" on public.driver_earnings
  for select using (motoboy_id = public.current_motoboy_id());
create policy "driver_earnings: admin lê todos" on public.driver_earnings
  for select using (public.is_platform_admin());

-- a chave Pix fica em motoboys.pix_key — a policy existente
-- "motoboys: o motoboy atualiza o próprio registro" (user_id = auth.uid()) já cobre.
