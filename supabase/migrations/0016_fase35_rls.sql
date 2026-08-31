-- =========================================================
-- LEEVA — FASE 3.5 — RLS
--
-- Regra: o ADMIN da plataforma (is_platform_admin()) enxerga tudo para
-- operação/suporte. Restaurante e motoboy mantêm o isolamento da Fase 2/3.
-- Escrita sensível continua só pelo servidor (service_role).
-- Políticas RLS são OR: adicionar uma policy de admin NÃO afrouxa as demais.
-- =========================================================

alter table public.platform_admins   enable row level security;
alter table public.dispatch_runs      enable row level security;
alter table public.rate_limit_hits    enable row level security;
alter table public.error_events       enable row level security;
alter table public.driver_incidents   enable row level security;
alter table public.reputation_config  enable row level security;

-- platform_admins: um admin lê a lista (para a tela de admins); ninguém escreve pelo client
create policy "platform_admins: admin lê" on public.platform_admins
  for select using (public.is_platform_admin());

-- dispatch_runs / error_events: só admin lê
create policy "dispatch_runs: admin lê" on public.dispatch_runs
  for select using (public.is_platform_admin());
create policy "error_events: admin lê" on public.error_events
  for select using (public.is_platform_admin());

-- rate_limit_hits: nenhum acesso via client (só service_role, que ignora RLS)

-- driver_incidents: o motoboy lê os próprios (transparência); admin lê todos
create policy "driver_incidents: motoboy lê os dele" on public.driver_incidents
  for select using (motoboy_id = public.current_motoboy_id());
create policy "driver_incidents: admin lê todos" on public.driver_incidents
  for select using (public.is_platform_admin());

-- reputation_config: admin lê e edita
create policy "reputation_config: admin gerencia" on public.reputation_config
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------------------------------------------------------
-- VISIBILIDADE DO ADMIN nas tabelas existentes (policies adicionais)
-- ---------------------------------------------------------
create policy "restaurants: admin lê todos" on public.restaurants
  for select using (public.is_platform_admin());
create policy "users: admin lê todos" on public.users
  for select using (public.is_platform_admin());
create policy "motoboys: admin lê todos" on public.motoboys
  for select using (public.is_platform_admin());
create policy "orders: admin lê todos" on public.orders
  for select using (public.is_platform_admin());
create policy "order_events: admin lê todos" on public.order_events
  for select using (public.is_platform_admin());
create policy "driver_locations: admin lê todos" on public.driver_locations
  for select using (public.is_platform_admin());
create policy "subscriptions: admin lê todas" on public.subscriptions
  for select using (public.is_platform_admin());
create policy "billing_events: admin lê todos" on public.billing_events
  for select using (public.is_platform_admin());
create policy "dispatch_attempts: admin lê todas" on public.dispatch_attempts
  for select using (public.is_platform_admin());
create policy "alerts: admin lê todos" on public.alerts
  for select using (public.is_platform_admin());
create policy "customers: admin lê todos" on public.customers
  for select using (public.is_platform_admin());
create policy "integrations: admin lê todas" on public.integrations
  for select using (public.is_platform_admin());

-- PLANS — o admin cria/edita o catálogo
create policy "plans: admin gerencia" on public.plans
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- PAYOUT POLICIES — o admin gerencia a política global (restaurant_id is null)
create policy "payout_policies: admin gerencia" on public.payout_policies
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
