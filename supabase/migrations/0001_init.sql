-- =========================================================
-- LEEVA — Fase 1 — Schema de fundação
-- Tabelas do core loop: PEDIDO -> DESPACHO -> MOTOBOY -> ROTA -> ENTREGA
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type user_role as enum ('restaurant_owner', 'restaurant_staff', 'motoboy');

create type motoboy_status as enum ('offline', 'available', 'on_delivery');

create type order_status as enum (
  'waiting_dispatch',
  'preparing',
  'ready',
  'assigned',
  'picked_up',
  'in_route',
  'delivered',
  'cancelled'
);

-- ---------- RESTAURANTS (tenant) ----------
create table public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- USERS (espelho de auth.users) ----------
create table public.users (
  id             uuid primary key references auth.users(id) on delete cascade,
  restaurant_id  uuid references public.restaurants(id) on delete cascade,
  role           user_role not null,
  full_name      text,
  phone          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint users_restaurant_required
    check (role = 'motoboy' or restaurant_id is not null)
);
create index users_restaurant_id_idx on public.users(restaurant_id);

-- ---------- MOTOBOYS ----------
create table public.motoboys (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  user_id        uuid unique references public.users(id) on delete set null, -- NULL até o motoboy ativar a conta
  full_name      text not null,
  phone          text not null,
  status         motoboy_status not null default 'offline',
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index motoboys_restaurant_id_idx on public.motoboys(restaurant_id);
create index motoboys_user_id_idx on public.motoboys(user_id);

-- ---------- ORDERS ----------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants(id) on delete cascade,
  motoboy_id        uuid references public.motoboys(id) on delete set null,

  customer_name     text not null,
  customer_phone    text,
  customer_address  text not null,

  order_amount      numeric(10,2) not null default 0,
  delivery_fee      numeric(10,2) not null default 0,

  status            order_status not null default 'waiting_dispatch',
  notes             text,

  -- milestones (base para indicadores)
  created_at        timestamptz not null default now(),
  preparing_at      timestamptz,
  ready_at          timestamptz,
  assigned_at       timestamptz,
  picked_up_at      timestamptz,
  in_route_at       timestamptz,
  delivered_at      timestamptz,
  cancelled_at      timestamptz,
  updated_at        timestamptz not null default now()
);
create index orders_restaurant_id_idx on public.orders(restaurant_id);
create index orders_motoboy_id_idx on public.orders(motoboy_id);
create index orders_status_idx on public.orders(restaurant_id, status);

-- ---------- ORDER STATUS HISTORY (log imutável) ----------
create table public.order_status_history (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  from_status    order_status,
  to_status      order_status not null,
  changed_by     uuid references public.users(id) on delete set null,
  changed_at     timestamptz not null default now()
);
create index osh_order_id_idx on public.order_status_history(order_id);
create index osh_restaurant_id_idx on public.order_status_history(restaurant_id);

-- =========================================================
-- TRIGGERS
-- =========================================================

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_restaurants_updated before update on public.restaurants
  for each row execute function public.set_updated_at();
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();
create trigger trg_motoboys_updated before update on public.motoboys
  for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

-- BEFORE: preenche a coluna de milestone correspondente ao status novo.
create or replace function public.fill_order_milestone()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'preparing' then new.preparing_at = coalesce(new.preparing_at, now());
      when 'ready'     then new.ready_at     = coalesce(new.ready_at, now());
      when 'assigned'  then new.assigned_at  = coalesce(new.assigned_at, now());
      when 'picked_up' then new.picked_up_at = coalesce(new.picked_up_at, now());
      when 'in_route'  then new.in_route_at  = coalesce(new.in_route_at, now());
      when 'delivered' then new.delivered_at = coalesce(new.delivered_at, now());
      when 'cancelled' then new.cancelled_at = coalesce(new.cancelled_at, now());
      else null;
    end case;
  end if;
  return new;
end $$;

create trigger trg_orders_fill_milestone
  before insert or update on public.orders
  for each row execute function public.fill_order_milestone();

-- AFTER: registra a transição no histórico (a linha do pedido já existe,
-- então a foreign key de order_status_history é satisfeita).
create or replace function public.log_order_status_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, restaurant_id, from_status, to_status, changed_by)
    values (new.id, new.restaurant_id, null, new.status, auth.uid());
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.order_status_history (order_id, restaurant_id, from_status, to_status, changed_by)
    values (new.id, new.restaurant_id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger trg_orders_status_log
  after insert or update on public.orders
  for each row execute function public.log_order_status_change();

-- cria a linha em public.users automaticamente quando alguém se cadastra no Auth.
-- O app envia role / full_name / phone / restaurant_id via "user metadata" no signup.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, role, full_name, phone, restaurant_id)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'motoboy'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'restaurant_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =========================================================
-- HELPERS de RLS
-- =========================================================

-- restaurant_id do usuário logado (evita repetir subquery nas políticas)
create or replace function public.current_restaurant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select restaurant_id from public.users where id = auth.uid();
$$;

-- role do usuário logado
create or replace function public.current_user_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

-- id do registro em motoboys correspondente ao usuário logado (ou null)
create or replace function public.current_motoboy_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.motoboys where user_id = auth.uid();
$$;
