-- =========================================================
-- LEEVA — FASE 2 — RLS + Realtime das novas tabelas
-- =========================================================

-- Funções acionadas por trigger que gravam linhas "de sistema" precisam
-- rodar com privilégio de dono para não esbarrar no RLS do usuário que
-- disparou a ação (ex: motoboy muda status -> gera order_event).
alter function public.log_order_status_change() security definer;
alter function public.emit_order_status_event() security definer;
alter function public.sync_motoboy_current_location() security definer;
alter function public.set_order_number() security definer;

-- ---------------------------------------------------------
alter table public.customers            enable row level security;
alter table public.order_items          enable row level security;
alter table public.driver_locations     enable row level security;
alter table public.order_events         enable row level security;
alter table public.notifications        enable row level security;
alter table public.alerts               enable row level security;
alter table public.integrations         enable row level security;
alter table public.integration_events   enable row level security;
alter table public.tracking_tokens      enable row level security;

-- CUSTOMERS ------------------------------------------------
create policy "customers: equipe gerencia os do restaurante"
  on public.customers for all
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'))
  with check (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

-- ORDER_ITEMS --------------------------------------------
create policy "order_items: equipe gerencia"
  on public.order_items for all
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'))
  with check (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

create policy "order_items: motoboy lê os itens da entrega dele"
  on public.order_items for select
  using (order_id in (select id from public.orders where motoboy_id = public.current_motoboy_id()));

-- DRIVER_LOCATIONS --------------------------------------
create policy "driver_locations: motoboy grava a própria posição"
  on public.driver_locations for insert
  with check (motoboy_id = public.current_motoboy_id());

create policy "driver_locations: motoboy lê a própria trilha"
  on public.driver_locations for select
  using (motoboy_id = public.current_motoboy_id());

create policy "driver_locations: equipe lê as do restaurante"
  on public.driver_locations for select
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

-- ORDER_EVENTS -----------------------------------------
create policy "order_events: equipe lê do restaurante"
  on public.order_events for select
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

create policy "order_events: motoboy lê os das entregas dele"
  on public.order_events for select
  using (order_id in (select id from public.orders where motoboy_id = public.current_motoboy_id()));

-- NOTIFICATIONS ----------------------------------------
create policy "notifications: equipe lê as do restaurante"
  on public.notifications for select
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

-- ALERTS -----------------------------------------------
create policy "alerts: equipe lê os do restaurante"
  on public.alerts for select
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

create policy "alerts: equipe resolve os do restaurante"
  on public.alerts for update
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'))
  with check (restaurant_id = public.current_restaurant_id());

-- INTEGRATIONS ----------------------------------------
create policy "integrations: dono gerencia"
  on public.integrations for all
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() = 'restaurant_owner')
  with check (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() = 'restaurant_owner');

create policy "integrations: staff lê"
  on public.integrations for select
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() = 'restaurant_staff');

-- INTEGRATION_EVENTS ---------------------------------
create policy "integration_events: equipe lê do restaurante"
  on public.integration_events for select
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

-- TRACKING_TOKENS -----------------------------------
-- Acesso público ao rastreamento NÃO passa por aqui: a rota /track usa o
-- cliente admin (service_role) e só busca pelo token. RLS fica trancado.
create policy "tracking_tokens: equipe lê do restaurante"
  on public.tracking_tokens for select
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

-- ---------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------
alter table public.order_events     replica identity full;
alter table public.alerts           replica identity full;
alter table public.driver_locations replica identity full;
alter table public.notifications    replica identity full;

alter publication supabase_realtime add table public.order_events;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.driver_locations;
alter publication supabase_realtime add table public.notifications;
