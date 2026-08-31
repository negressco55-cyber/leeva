-- =========================================================
-- LEEVA — Fase 1 — Row Level Security (multi-tenant)
-- Regra geral: cada usuário só enxerga dados do próprio restaurant_id.
-- Motoboy só enxerga a si mesmo e as entregas atribuídas a ele.
-- As funções helper (current_restaurant_id, current_user_role,
-- current_motoboy_id) são SECURITY DEFINER, então rodam sem RLS
-- e não causam recursão.
-- =========================================================

alter table public.restaurants          enable row level security;
alter table public.users                enable row level security;
alter table public.motoboys             enable row level security;
alter table public.orders               enable row level security;
alter table public.order_status_history enable row level security;

-- ---------------------------------------------------------
-- RESTAURANTS
-- ---------------------------------------------------------
create policy "restaurants: membro lê o próprio"
  on public.restaurants for select
  using (id = public.current_restaurant_id());

create policy "restaurants: owner atualiza o próprio"
  on public.restaurants for update
  using (id = public.current_restaurant_id() and public.current_user_role() = 'restaurant_owner')
  with check (id = public.current_restaurant_id());

-- INSERT de restaurante é feito pelo fluxo de signup no servidor
-- (rota /auth/signup usando a service_role key), então não há policy de INSERT aqui.

-- ---------------------------------------------------------
-- USERS
-- ---------------------------------------------------------
create policy "users: lê o próprio registro"
  on public.users for select
  using (id = auth.uid());

create policy "users: staff/owner leem colegas do mesmo restaurante"
  on public.users for select
  using (
    restaurant_id is not null
    and restaurant_id = public.current_restaurant_id()
  );

create policy "users: atualiza o próprio perfil"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------
-- MOTOBOYS
-- ---------------------------------------------------------
create policy "motoboys: staff/owner gerenciam os do restaurante"
  on public.motoboys for all
  using (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() in ('restaurant_owner', 'restaurant_staff')
  )
  with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() in ('restaurant_owner', 'restaurant_staff')
  );

create policy "motoboys: o motoboy lê o próprio registro"
  on public.motoboys for select
  using (user_id = auth.uid());

create policy "motoboys: o motoboy atualiza o próprio registro"
  on public.motoboys for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------
create policy "orders: staff/owner gerenciam os pedidos do restaurante"
  on public.orders for all
  using (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() in ('restaurant_owner', 'restaurant_staff')
  )
  with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() in ('restaurant_owner', 'restaurant_staff')
  );

create policy "orders: motoboy lê as entregas atribuídas a ele"
  on public.orders for select
  using (motoboy_id = public.current_motoboy_id());

create policy "orders: motoboy atualiza as entregas atribuídas a ele"
  on public.orders for update
  using (motoboy_id = public.current_motoboy_id())
  with check (motoboy_id = public.current_motoboy_id());

-- ---------------------------------------------------------
-- ORDER STATUS HISTORY (somente leitura pelo app; escrita é via trigger)
-- ---------------------------------------------------------
create policy "history: membros leem o histórico do restaurante"
  on public.order_status_history for select
  using (restaurant_id = public.current_restaurant_id());

create policy "history: motoboy lê o histórico das suas entregas"
  on public.order_status_history for select
  using (
    order_id in (
      select id from public.orders where motoboy_id = public.current_motoboy_id()
    )
  );
