-- =========================================================
-- LEEVA — FASE 3 — produto comercial
--
-- Despacho automático, frota (própria/rede), remuneração configurável,
-- billing SaaS, financeiro da logística, dados de pagamento da venda.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------
create type payment_method as enum ('cash', 'card_on_delivery', 'online', 'pix', 'other', 'unknown');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create type fleet_mode as enum ('own', 'leeva', 'hybrid');
create type driver_fleet as enum ('own', 'leeva');

-- estado do DESPACHO (ortogonal ao status do pedido)
create type dispatch_state as enum ('none', 'searching', 'offered', 'assigned', 'failed');

create type dispatch_outcome as enum ('accepted', 'declined', 'timeout', 'cancelled', 'expired');

create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
create type billing_event_type as enum ('subscription_fee', 'delivery_fee', 'adjustment', 'credit');

-- ---------------------------------------------------------
-- PLANS (catálogo de planos SaaS)
-- ---------------------------------------------------------
create table public.plans (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,          -- 'start' | 'pro' | 'business'
  name               text not null,
  monthly_price      numeric(10,2) not null default 0,
  per_delivery_price numeric(10,4) not null default 0,
  features           jsonb not null default '{}'::jsonb,  -- { map:true, heatmap:false, auto_dispatch:true, ... }
  trial_days         integer not null default 14,
  sort_order         integer not null default 0,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

insert into public.plans (code, name, monthly_price, per_delivery_price, trial_days, sort_order, features) values
  ('start',    'Start',    49.90, 0.80, 14, 1, '{"auto_dispatch":true,"map":true,"tracking":true,"heatmap":false,"grouping":true,"own_fleet":true,"leeva_network":false,"api":false,"max_active_orders":30}'),
  ('pro',      'Pro',      99.90, 0.50, 14, 2, '{"auto_dispatch":true,"map":true,"tracking":true,"heatmap":true,"grouping":true,"own_fleet":true,"leeva_network":true,"api":true,"finance":true,"max_active_orders":120}'),
  ('business', 'Business', 199.90,0.30, 14, 3, '{"auto_dispatch":true,"map":true,"tracking":true,"heatmap":true,"grouping":true,"own_fleet":true,"leeva_network":true,"api":true,"finance":true,"insights":true,"max_active_orders":1000}');

-- ---------------------------------------------------------
-- SUBSCRIPTIONS
-- ---------------------------------------------------------
create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  restaurant_id         uuid not null references public.restaurants(id) on delete cascade,
  plan_id               uuid not null references public.plans(id),
  status                subscription_status not null default 'trialing',
  current_period_start  timestamptz not null default date_trunc('month', now()),
  current_period_end    timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  trial_ends_at         timestamptz,
  canceled_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (restaurant_id)   -- 1 assinatura ativa por restaurante
);
create index subscriptions_restaurant_idx on public.subscriptions(restaurant_id);

-- ---------------------------------------------------------
-- BILLING EVENTS (linhas da fatura)
-- ---------------------------------------------------------
create table public.billing_events (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  type           billing_event_type not null,
  amount         numeric(12,2) not null default 0,
  description    text not null,
  period_start   timestamptz,
  period_end     timestamptz,
  order_id       uuid references public.orders(id) on delete set null,
  data           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index billing_events_restaurant_idx on public.billing_events(restaurant_id, created_at desc);
create index billing_events_period_idx on public.billing_events(restaurant_id, period_start);
-- idempotência: 1 cobrança de entrega por pedido
create unique index billing_events_delivery_idx
  on public.billing_events(order_id) where type = 'delivery_fee' and order_id is not null;

-- ---------------------------------------------------------
-- PAYOUT POLICIES (motor de remuneração do motoboy — configurável)
-- ---------------------------------------------------------
create table public.payout_policies (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid references public.restaurants(id) on delete cascade,  -- null = política padrão global
  name           text not null default 'Padrão',
  config         jsonb not null default '{
    "base": 7.50,
    "per_km": 0.00,
    "free_km": 2.0,
    "grouped_extra": 3.00,
    "peak_bonus": 0.00,
    "peak_hours": [[18,21]],
    "min_payout": 7.50
  }'::jsonb,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index payout_policies_global_idx on public.payout_policies((restaurant_id is null)) where restaurant_id is null;
create index payout_policies_restaurant_idx on public.payout_policies(restaurant_id);

insert into public.payout_policies (restaurant_id, name) values (null, 'Padrão Leeva');

-- ---------------------------------------------------------
-- DISPATCH ATTEMPTS (ofertas automáticas + fallback)
-- ---------------------------------------------------------
create table public.dispatch_attempts (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  order_id        uuid not null references public.orders(id) on delete cascade,
  motoboy_id      uuid not null references public.motoboys(id) on delete cascade,
  attempt_number  integer not null default 1,
  score           numeric(6,2),
  score_breakdown jsonb not null default '{}'::jsonb,
  offered_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '45 seconds'),
  responded_at    timestamptz,
  outcome         dispatch_outcome,
  reason          text,
  created_at      timestamptz not null default now()
);
create index dispatch_attempts_order_idx on public.dispatch_attempts(order_id, attempt_number);
create index dispatch_attempts_motoboy_idx on public.dispatch_attempts(motoboy_id);
-- no máximo 1 oferta "aberta" (sem resposta) por pedido
create unique index dispatch_attempts_open_idx
  on public.dispatch_attempts(order_id) where responded_at is null;

-- ---------------------------------------------------------
-- Extensões em RESTAURANTS
-- ---------------------------------------------------------
alter table public.restaurants
  add column fleet_mode            fleet_mode not null default 'leeva',
  add column onboarding_completed  boolean not null default false,
  add column logistics_config      jsonb not null default '{
    "service_radius_km": 8,
    "customer_fee": 9.50,
    "free_delivery_min_order": null,
    "min_order": 0,
    "grouping_enabled": true,
    "auto_dispatch_enabled": true,
    "offer_timeout_seconds": 45,
    "max_dispatch_attempts": 4
  }'::jsonb;

-- ---------------------------------------------------------
-- Extensões em MOTOBOYS (rede + métricas de confiabilidade)
-- ---------------------------------------------------------
alter table public.motoboys
  alter column restaurant_id drop not null;

alter table public.motoboys
  add column fleet                 driver_fleet not null default 'own',
  add column rating                numeric(3,2) not null default 5.00,
  add column deliveries_total      integer not null default 0,
  add column deliveries_completed  integer not null default 0,
  add column deliveries_late       integer not null default 0,
  add column avg_delay_min         numeric(6,2) not null default 0;

-- confiabilidade (0..1) e taxa de conclusão são derivadas — helper:
create or replace function public.motoboy_completion_rate(m public.motoboys)
returns numeric language sql immutable as $$
  select case when m.deliveries_total = 0 then 1.0
              else round(m.deliveries_completed::numeric / m.deliveries_total, 4) end
$$;

-- ---------------------------------------------------------
-- Extensões em ORDERS (pagamento da venda + financeiro logístico + despacho)
-- ---------------------------------------------------------
alter table public.orders
  add column payment_method       payment_method not null default 'unknown',
  add column payment_status       payment_status not null default 'pending',
  add column dispatch_state       dispatch_state not null default 'none',
  add column dispatch_attempts    integer not null default 0,
  add column route_distance_km    numeric(8,2),
  add column route_duration_min   numeric(8,2),
  add column customer_fee         numeric(10,2),   -- taxa cobrada do cliente pela entrega (logística)
  add column leeva_fee            numeric(10,2),   -- receita da logística Leeva nesta entrega
  add column driver_payout        numeric(10,2),  -- remuneração do entregador
  add column logistics_margin     numeric(10,2) generated always as (coalesce(leeva_fee,0) - coalesce(driver_payout,0)) stored,
  add column dispatched_at        timestamptz,
  add column accepted_at          timestamptz;

create index orders_dispatch_state_idx on public.orders(restaurant_id, dispatch_state)
  where dispatch_state in ('searching', 'offered', 'failed');

-- ---------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger trg_payout_policies_updated before update on public.payout_policies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- trigger: quando o motoboy aceita (status -> assigned via oferta) grava accepted_at;
-- quando é despachado grava dispatched_at. (a aplicação também seta, isto é rede de segurança)
-- ---------------------------------------------------------
create or replace function public.fill_dispatch_timestamps()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.dispatch_state = 'offered' and old.dispatch_state is distinct from 'offered' then
      new.dispatched_at := coalesce(new.dispatched_at, now());
    end if;
    if new.status = 'assigned' and old.status is distinct from 'assigned' then
      new.accepted_at := coalesce(new.accepted_at, now());
    end if;
  end if;
  return new;
end $$;

create trigger trg_orders_dispatch_ts
  before update on public.orders
  for each row execute function public.fill_dispatch_timestamps();

-- ---------------------------------------------------------
-- métricas do motoboy ao concluir/cancelar entrega
-- ---------------------------------------------------------
create or replace function public.update_motoboy_metrics()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  total_min numeric;
  sla_min constant integer := 55;
begin
  if tg_op = 'UPDATE' and new.motoboy_id is not null
     and new.status in ('delivered','cancelled')
     and old.status not in ('delivered','cancelled') then

    if new.status = 'delivered' then
      total_min := extract(epoch from (coalesce(new.delivered_at, now()) - new.created_at)) / 60.0;
      update public.motoboys m set
        deliveries_total = m.deliveries_total + 1,
        deliveries_completed = m.deliveries_completed + 1,
        deliveries_late = m.deliveries_late + (case when total_min > sla_min then 1 else 0 end),
        avg_delay_min = round(
          ((m.avg_delay_min * m.deliveries_completed) + greatest(0, total_min - sla_min))
          / (m.deliveries_completed + 1), 2)
      where m.id = new.motoboy_id;
    else
      update public.motoboys m set deliveries_total = m.deliveries_total + 1
      where m.id = new.motoboy_id;
    end if;
  end if;
  return new;
end $$;

create trigger trg_orders_motoboy_metrics
  after update on public.orders
  for each row execute function public.update_motoboy_metrics();
