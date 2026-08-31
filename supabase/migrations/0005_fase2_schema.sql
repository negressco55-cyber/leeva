-- =========================================================
-- LEEVA — FASE 2 — Central de pedidos, despacho, rastreamento,
-- eventos, notificações, alertas, integrações e indicadores.
--
-- Convenção: "restaurant" = tenant/organização. restaurant_id é a
-- chave de isolamento multi-tenant em todas as tabelas novas.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------
create type order_source as enum ('manual', 'ifood', 'whatsapp', 'menu', 'api');

create type notification_channel as enum ('in_app', 'whatsapp', 'sms', 'push');
create type notification_recipient as enum ('customer', 'restaurant', 'motoboy');
create type notification_status as enum ('pending', 'sent', 'failed', 'skipped');

create type alert_type as enum ('delay', 'no_driver', 'demand_spike', 'normal', 'long_prep');
create type alert_severity as enum ('info', 'warning', 'critical', 'ok');

create type integration_provider as enum ('ifood', 'whatsapp', 'sms', 'push', 'maps');
create type integration_status as enum ('implemented', 'prepared', 'mock', 'disabled');

create type integration_event_status as enum ('received', 'processed', 'failed', 'duplicate', 'ignored');

-- ---------------------------------------------------------
-- CUSTOMERS — cadastro leve de clientes por restaurante
-- ---------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null,
  phone          text,
  address        text,
  latitude       double precision,
  longitude      double precision,
  region         text,
  notes          text,
  orders_count   integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index customers_restaurant_id_idx on public.customers(restaurant_id);
create index customers_phone_idx on public.customers(restaurant_id, phone);

-- ---------------------------------------------------------
-- Extensões em ORDERS
-- ---------------------------------------------------------
alter table public.orders
  add column order_number   integer,
  add column source         order_source not null default 'manual',
  add column external_id    text,
  add column customer_id    uuid references public.customers(id) on delete set null,
  add column latitude       double precision,
  add column longitude      double precision,
  add column region         text,
  add column confirmed_at   timestamptz,
  add column group_id       uuid,          -- agrupamento de entregas
  add column eta_min        integer,       -- previsão (minutos) - piso do intervalo
  add column eta_max        integer,       -- previsão (minutos) - teto do intervalo
  add column eta_computed_at timestamptz;

-- número sequencial do pedido por restaurante
create unique index orders_restaurant_number_idx
  on public.orders(restaurant_id, order_number);

-- idempotência: um pedido externo (source + external_id) só entra uma vez por restaurante
create unique index orders_source_external_idx
  on public.orders(restaurant_id, source, external_id)
  where external_id is not null;

create index orders_group_id_idx on public.orders(group_id) where group_id is not null;
create index orders_source_idx on public.orders(restaurant_id, source);
create index orders_created_at_idx on public.orders(restaurant_id, created_at desc);

create or replace function public.set_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    select coalesce(max(order_number), 0) + 1
      into new.order_number
      from public.orders
      where restaurant_id = new.restaurant_id;
  end if;
  return new;
end $$;

create trigger trg_orders_set_number
  before insert on public.orders
  for each row execute function public.set_order_number();

-- confirmed_at quando o pedido sai de waiting_dispatch
create or replace function public.fill_order_confirmed()
returns trigger language plpgsql as $$
begin
  if new.confirmed_at is null
     and new.status <> 'waiting_dispatch'
     and (tg_op = 'INSERT' or old.status = 'waiting_dispatch') then
    new.confirmed_at = now();
  end if;
  return new;
end $$;

create trigger trg_orders_fill_confirmed
  before insert or update on public.orders
  for each row execute function public.fill_order_confirmed();

-- ---------------------------------------------------------
-- ORDER_ITEMS
-- ---------------------------------------------------------
create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,
  quantity      integer not null default 1 check (quantity > 0),
  unit_price    numeric(10,2) not null default 0,
  notes         text,
  created_at    timestamptz not null default now()
);
create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_restaurant_id_idx on public.order_items(restaurant_id);

-- ---------------------------------------------------------
-- Extensões em MOTOBOYS (localização + capacidade)
-- ---------------------------------------------------------
alter table public.motoboys
  add column current_latitude        double precision,
  add column current_longitude       double precision,
  add column location_updated_at     timestamptz,
  add column max_concurrent_deliveries integer not null default 3,
  add column vehicle                 text default 'moto';

-- ---------------------------------------------------------
-- DRIVER_LOCATIONS — histórico de localização (retenção curta)
-- ---------------------------------------------------------
create table public.driver_locations (
  id             bigint generated always as identity primary key,
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  motoboy_id     uuid not null references public.motoboys(id) on delete cascade,
  order_id       uuid references public.orders(id) on delete set null,
  latitude       double precision not null,
  longitude      double precision not null,
  accuracy       double precision,
  speed          double precision,
  recorded_at    timestamptz not null default now()
);
create index driver_locations_motoboy_idx on public.driver_locations(motoboy_id, recorded_at desc);
create index driver_locations_order_idx on public.driver_locations(order_id, recorded_at desc);
create index driver_locations_recorded_at_idx on public.driver_locations(recorded_at);

-- Retenção: mantém no máximo ~24h de rastros. Rodar via cron (pg_cron)
-- ou pela rota /api/cron/cleanup. Ver docs/DATA-RETENTION.md
create or replace function public.cleanup_driver_locations(retention interval default '24 hours')
returns integer language plpgsql security definer set search_path = public as $$
declare
  deleted integer;
begin
  delete from public.driver_locations where recorded_at < now() - retention;
  get diagnostics deleted = row_count;
  return deleted;
end $$;

-- Ao gravar uma localização, atualiza a posição "atual" do motoboy
create or replace function public.sync_motoboy_current_location()
returns trigger language plpgsql as $$
begin
  update public.motoboys
     set current_latitude = new.latitude,
         current_longitude = new.longitude,
         location_updated_at = new.recorded_at
   where id = new.motoboy_id;
  return new;
end $$;

create trigger trg_driver_locations_sync
  after insert on public.driver_locations
  for each row execute function public.sync_motoboy_current_location();

-- ---------------------------------------------------------
-- ORDER_EVENTS — log de domínio (event sourcing leve)
-- ---------------------------------------------------------
create table public.order_events (
  id             bigint generated always as identity primary key,
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  order_id       uuid not null references public.orders(id) on delete cascade,
  type           text not null,             -- ex: 'order.created', 'delivery.picked_up'
  actor_type     text,                      -- 'restaurant' | 'motoboy' | 'system' | 'customer' | 'integration'
  actor_id       uuid,
  data           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, created_at);
create index order_events_restaurant_idx on public.order_events(restaurant_id, created_at desc);
create index order_events_type_idx on public.order_events(restaurant_id, type);

-- ---------------------------------------------------------
-- NOTIFICATIONS — fila central de notificações
-- ---------------------------------------------------------
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  order_id       uuid references public.orders(id) on delete cascade,
  channel        notification_channel not null,
  recipient_type notification_recipient not null,
  recipient      text,                      -- telefone/token/etc conforme o canal
  template       text not null,             -- ex: 'customer.out_for_delivery'
  title          text,
  body           text not null,
  data           jsonb not null default '{}'::jsonb,
  status         notification_status not null default 'pending',
  error          text,
  attempts       integer not null default 0,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);
create index notifications_restaurant_idx on public.notifications(restaurant_id, created_at desc);
create index notifications_order_idx on public.notifications(order_id);
create index notifications_status_idx on public.notifications(status) where status = 'pending';

-- ---------------------------------------------------------
-- ALERTS — alertas operacionais (regras determinísticas)
-- ---------------------------------------------------------
create table public.alerts (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  type           alert_type not null,
  severity       alert_severity not null,
  key            text not null,             -- chave de deduplicação (ex: 'delay:<order_id>')
  title          text not null,
  message        text not null,
  data           jsonb not null default '{}'::jsonb,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create unique index alerts_restaurant_key_active_idx
  on public.alerts(restaurant_id, key) where active;
create index alerts_restaurant_active_idx on public.alerts(restaurant_id) where active;

-- ---------------------------------------------------------
-- INTEGRATIONS — configuração por restaurante (sem segredos)
-- ---------------------------------------------------------
create table public.integrations (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  provider        integration_provider not null,
  status          integration_status not null default 'prepared',
  config          jsonb not null default '{}'::jsonb,   -- dados NÃO sensíveis
  credentials_set boolean not null default false,       -- se os segredos foram configurados (em env/secret manager)
  webhook_secret_hint text,                             -- ex: últimos 4 dígitos, NUNCA o segredo
  last_event_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (restaurant_id, provider)
);
create index integrations_restaurant_idx on public.integrations(restaurant_id);

-- ---------------------------------------------------------
-- INTEGRATION_EVENTS — log de webhooks/eventos externos + idempotência
-- ---------------------------------------------------------
create table public.integration_events (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid references public.restaurants(id) on delete cascade,
  provider          integration_provider not null,
  direction         text not null default 'inbound',   -- inbound | outbound
  event_id          text,                              -- id do evento no provedor (idempotência)
  external_order_id text,
  order_id          uuid references public.orders(id) on delete set null,
  signature_valid   boolean,
  status            integration_event_status not null default 'received',
  error             text,
  attempts          integer not null default 0,
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  processed_at      timestamptz
);
-- idempotência forte: o mesmo event_id do mesmo provedor entra uma vez
create unique index integration_events_provider_event_idx
  on public.integration_events(provider, event_id) where event_id is not null;
create index integration_events_restaurant_idx on public.integration_events(restaurant_id, created_at desc);
create index integration_events_status_idx on public.integration_events(status);

-- ---------------------------------------------------------
-- TRACKING_TOKENS — links públicos de rastreamento
-- ---------------------------------------------------------
create table public.tracking_tokens (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  order_id       uuid not null references public.orders(id) on delete cascade,
  token          text not null unique,
  expires_at     timestamptz,
  revoked        boolean not null default false,
  views          integer not null default 0,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);
create index tracking_tokens_order_idx on public.tracking_tokens(order_id);
create index tracking_tokens_token_idx on public.tracking_tokens(token);

-- gera automaticamente um token de rastreamento quando o pedido é criado
create or replace function public.create_tracking_token()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tracking_tokens (restaurant_id, order_id, token, expires_at)
  values (
    new.restaurant_id,
    new.id,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    now() + interval '2 days'
  )
  on conflict do nothing;
  return new;
end $$;

create trigger trg_orders_tracking_token
  after insert on public.orders
  for each row execute function public.create_tracking_token();

-- ---------------------------------------------------------
-- updated_at nas tabelas novas
-- ---------------------------------------------------------
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();
create trigger trg_alerts_updated before update on public.alerts
  for each row execute function public.set_updated_at();
create trigger trg_integrations_updated before update on public.integrations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- order_events automáticos a partir da mudança de status
-- (AFTER: a linha já existe, FK garantida)
-- ---------------------------------------------------------
create or replace function public.emit_order_status_event()
returns trigger language plpgsql as $$
declare
  ev text;
begin
  if tg_op = 'INSERT' then
    ev := 'order.created';
  elsif new.status is distinct from old.status then
    ev := case new.status
      when 'preparing'  then 'order.preparing'
      when 'ready'       then 'order.ready'
      when 'assigned'    then 'delivery.assigned'
      when 'picked_up'   then 'delivery.picked_up'
      when 'in_route'    then 'delivery.started'
      when 'delivered'   then 'delivery.delivered'
      when 'cancelled'   then 'delivery.cancelled'
      else 'order.updated'
    end;
  else
    return new;
  end if;

  insert into public.order_events (restaurant_id, order_id, type, actor_type, data)
  values (
    new.restaurant_id, new.id, ev, 'system',
    jsonb_build_object('status', new.status, 'motoboy_id', new.motoboy_id)
  );
  return new;
end $$;

create trigger trg_orders_emit_event
  after insert or update on public.orders
  for each row execute function public.emit_order_status_event();

-- ---------------------------------------------------------
-- Helper: mede distância em km (Haversine) — determinístico, sem API externa.
-- É distância em linha reta. O RoutingService pode sobrepor com rota real.
-- ---------------------------------------------------------
create or replace function public.haversine_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision language sql immutable as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 2 * 6371 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lon2 - lon1) / 2), 2)
    ))
  end
$$;
