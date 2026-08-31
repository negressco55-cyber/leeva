-- =========================================================
-- LEEVA — FASE 3 — RLS + Realtime das tabelas novas
-- =========================================================

alter function public.update_motoboy_metrics() security definer;

alter table public.plans              enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.billing_events     enable row level security;
alter table public.payout_policies    enable row level security;
alter table public.dispatch_attempts  enable row level security;

-- PLANS — catálogo público para usuários autenticados (onboarding)
create policy "plans: qualquer autenticado lê os ativos"
  on public.plans for select
  using (auth.uid() is not null and active);

-- SUBSCRIPTIONS — o restaurante lê a própria
create policy "subscriptions: equipe lê a do restaurante"
  on public.subscriptions for select
  using (restaurant_id = public.current_restaurant_id());
-- escrita só pelo servidor (service_role / rotas)

-- BILLING EVENTS — o restaurante lê os próprios
create policy "billing_events: equipe lê os do restaurante"
  on public.billing_events for select
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

-- PAYOUT POLICIES — o dono lê/edita a do próprio restaurante (não a global)
create policy "payout_policies: dono gerencia a do restaurante"
  on public.payout_policies for all
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() = 'restaurant_owner')
  with check (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() = 'restaurant_owner');

-- DISPATCH ATTEMPTS
--  - equipe do restaurante lê (para a UI "procurando entregador...")
--  - o motoboy lê as ofertas endereçadas a ele
create policy "dispatch_attempts: equipe lê as do restaurante"
  on public.dispatch_attempts for select
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() in ('restaurant_owner','restaurant_staff'));

create policy "dispatch_attempts: motoboy lê as ofertas dele"
  on public.dispatch_attempts for select
  using (motoboy_id = public.current_motoboy_id());

-- ---------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------
alter table public.dispatch_attempts replica identity full;
alter table public.subscriptions     replica identity full;

alter publication supabase_realtime add table public.dispatch_attempts;

-- ---------------------------------------------------------
-- RLS de MOTOBOYS: a política existente já esconde os da rede Leeva
-- (restaurant_id IS NULL nunca casa com current_restaurant_id()).
-- Reforço explícito: o restaurante só enxerga a PRÓPRIA frota.
-- ---------------------------------------------------------
drop policy if exists "motoboys: staff/owner gerenciam os do restaurante" on public.motoboys;
create policy "motoboys: staff/owner gerenciam a frota própria"
  on public.motoboys for all
  using (
    restaurant_id is not null
    and restaurant_id = public.current_restaurant_id()
    and fleet = 'own'
    and public.current_user_role() in ('restaurant_owner', 'restaurant_staff')
  )
  with check (
    restaurant_id is not null
    and restaurant_id = public.current_restaurant_id()
    and fleet = 'own'
    and public.current_user_role() in ('restaurant_owner', 'restaurant_staff')
  );
