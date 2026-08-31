-- =========================================================
-- LEEVA — FASE 4 (Bloco 2) — Créditos pré-pagos
--
-- O restaurante compra pacotes de crédito. Cada entrega desconta do saldo
-- o TOTAL (valor do motoboy + margem do plano). Não pode solicitar mais
-- entregas do que o saldo permite. Cancelamento estorna.
-- Mensalidade é cobrada à parte, NÃO consome crédito.
-- =========================================================

create type credit_movement as enum ('purchase', 'consumption', 'refund', 'adjustment', 'bonus');

-- saldo atual (materializado — débito atômico com CHECK de saldo)
create table public.restaurant_credits (
  restaurant_id         uuid primary key references public.restaurants(id) on delete cascade,
  balance               numeric(12,2) not null default 0,
  low_balance_threshold numeric(12,2) not null default 20,
  updated_at            timestamptz not null default now()
);

-- histórico de movimentações
create table public.credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind          credit_movement not null,
  amount        numeric(12,2) not null,          -- assinado: + entra, − sai
  balance_after numeric(12,2) not null,
  order_id      uuid references public.orders(id) on delete set null,
  description   text not null,
  external_ref  text,                            -- id do pagamento (Asaas — Bloco 3)
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index credit_ledger_restaurant_idx on public.credit_ledger(restaurant_id, created_at desc);
create unique index credit_ledger_consumption_idx
  on public.credit_ledger(order_id) where kind = 'consumption' and order_id is not null;

-- pacotes de crédito à venda (configurável no admin)
create table public.credit_packages (
  id         uuid primary key default gen_random_uuid(),
  amount     numeric(12,2) not null,
  bonus      numeric(12,2) not null default 0,   -- crédito extra grátis
  label      text,
  sort_order integer not null default 0,
  active     boolean not null default true
);
insert into public.credit_packages (amount, sort_order) values (50, 1), (100, 2), (200, 3);

-- ---------------------------------------------------------
-- FUNÇÕES ATÔMICAS
-- ---------------------------------------------------------

-- adiciona crédito (compra / bônus / estorno manual / ajuste)
create or replace function public.credit_add(
  p_restaurant_id uuid,
  p_amount        numeric,
  p_kind          credit_movement,
  p_description   text,
  p_external_ref  text default null,
  p_created_by    uuid default null
) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_bal numeric;
begin
  if p_amount <= 0 then raise exception 'valor deve ser positivo'; end if;

  insert into public.restaurant_credits (restaurant_id, balance)
    values (p_restaurant_id, p_amount)
  on conflict (restaurant_id)
    do update set balance = public.restaurant_credits.balance + p_amount, updated_at = now()
  returning balance into v_bal;

  insert into public.credit_ledger (restaurant_id, kind, amount, balance_after, description, external_ref, created_by)
    values (p_restaurant_id, p_kind, p_amount, v_bal, p_description, p_external_ref, p_created_by);

  return v_bal;
end $$;

-- consome crédito para uma entrega. Atômico: só debita se houver saldo.
-- Idempotente por order_id. TRUE => debitado (ou já debitado, ou taxa 0).
-- (assinatura corrigida na 0022 — OUT params allowed/new_balance)
create or replace function public.credit_consume(
  p_restaurant_id uuid,
  p_amount        numeric,
  p_order_id      uuid,
  p_description   text
) returns table(allowed boolean, new_balance numeric)
language plpgsql security definer set search_path = public as $$
declare v_bal numeric;
begin
  if exists (select 1 from public.credit_ledger where order_id = p_order_id and kind = 'consumption') then
    select rc.balance into v_bal from public.restaurant_credits rc where rc.restaurant_id = p_restaurant_id;
    return query select true, coalesce(v_bal, 0::numeric);
    return;
  end if;

  if p_amount is null or p_amount <= 0 then
    select rc.balance into v_bal from public.restaurant_credits rc where rc.restaurant_id = p_restaurant_id;
    return query select true, coalesce(v_bal, 0::numeric);
    return;
  end if;

  update public.restaurant_credits rc
     set balance = rc.balance - p_amount, updated_at = now()
   where rc.restaurant_id = p_restaurant_id and rc.balance >= p_amount
  returning rc.balance into v_bal;

  if not found then
    select rc.balance into v_bal from public.restaurant_credits rc where rc.restaurant_id = p_restaurant_id;
    return query select false, coalesce(v_bal, 0::numeric);
    return;
  end if;

  insert into public.credit_ledger (restaurant_id, kind, amount, balance_after, order_id, description)
    values (p_restaurant_id, 'consumption', -p_amount, v_bal, p_order_id, p_description);

  return query select true, v_bal;
end $$;

-- estorna o crédito consumido por um pedido (cancelamento). Não estorna 2×.
create or replace function public.credit_refund(
  p_order_id uuid,
  p_description text default 'estorno de cancelamento'
) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_amount numeric; v_restaurant uuid; v_bal numeric;
begin
  select -amount, restaurant_id into v_amount, v_restaurant
    from public.credit_ledger where order_id = p_order_id and kind = 'consumption' limit 1;
  if v_amount is null then return null; end if;  -- nunca consumiu
  if exists (select 1 from public.credit_ledger where order_id = p_order_id and kind = 'refund') then
    return null;  -- já estornado
  end if;

  update public.restaurant_credits
     set balance = balance + v_amount, updated_at = now()
   where restaurant_id = v_restaurant
  returning balance into v_bal;

  insert into public.credit_ledger (restaurant_id, kind, amount, balance_after, order_id, description)
    values (v_restaurant, 'refund', v_amount, v_bal, p_order_id, p_description);

  return v_bal;
end $$;
