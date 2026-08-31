-- =========================================================
-- LEEVA — FASE 4 (Bloco 2) — RLS dos créditos
-- =========================================================

alter table public.restaurant_credits enable row level security;
alter table public.credit_ledger      enable row level security;
alter table public.credit_packages    enable row level security;

-- restaurant_credits: o restaurante lê o próprio saldo; admin lê todos.
-- Escrita só pelas funções SECURITY DEFINER / service_role.
create policy "restaurant_credits: equipe lê o saldo do restaurante"
  on public.restaurant_credits for select
  using (restaurant_id = public.current_restaurant_id());
create policy "restaurant_credits: admin lê todos"
  on public.restaurant_credits for select
  using (public.is_platform_admin());

-- credit_ledger: o restaurante lê o próprio histórico; admin lê todos.
create policy "credit_ledger: equipe lê o histórico do restaurante"
  on public.credit_ledger for select
  using (restaurant_id = public.current_restaurant_id());
create policy "credit_ledger: admin lê todos"
  on public.credit_ledger for select
  using (public.is_platform_admin());

-- credit_packages: catálogo — qualquer autenticado lê os ativos; admin gerencia.
create policy "credit_packages: autenticado lê ativos"
  on public.credit_packages for select
  using (auth.uid() is not null and active);
create policy "credit_packages: admin gerencia"
  on public.credit_packages for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Realtime do saldo (o painel do restaurante atualiza sozinho após uma compra)
alter table public.restaurant_credits replica identity full;
alter publication supabase_realtime add table public.restaurant_credits;
