-- Modo "frota própria + mensalidade" (modelo Foody).
--
-- O estabelecimento usa os PRÓPRIOS motoboys e paga eles direto. O Leeva só
-- cobra a mensalidade: não há margem por entrega, não desconta crédito e o
-- dinheiro do motoboy não passa pela carteira do Leeva.

-- 1) Ordem das paradas escolhida pelo motoboy (ou sugerida pelo otimizador).
--    NULL = sem ordem definida (cai em group_sequence / assigned_at).
alter table public.orders add column if not exists route_position integer;
create index if not exists orders_route_position_idx
  on public.orders(motoboy_id, route_position) where motoboy_id is not null;

-- 2) Motoboy da frota própria NÃO ganha saldo na carteira do Leeva:
--    quem paga é o estabelecimento (acerto em /financeiro do restaurante).
create or replace function public.record_driver_earning()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'delivered' and old.status is distinct from 'delivered'
     and new.motoboy_id is not null and coalesce(new.driver_payout, 0) > 0
     and not exists (
       select 1 from public.motoboys m where m.id = new.motoboy_id and m.fleet = 'own'
     ) then
    insert into public.driver_earnings (motoboy_id, order_id, amount)
      values (new.motoboy_id, new.id, new.driver_payout)
    on conflict (order_id) do nothing;
  end if;
  return new;
end $$;

-- 3) Plano mensal (frota própria). Preço editável no admin › Planos & Taxas.
insert into public.plans (code, name, monthly_price, per_delivery_price, per_delivery_margin, trial_days, sort_order, active, features)
values (
  'mensal',
  'Mensal — frota própria',
  149,
  0,
  0,
  14,
  1,
  true,
  '{"auto_dispatch":true,"map":true,"tracking":true,"heatmap":true,"grouping":true,"own_fleet":true,"leeva_network":false,"api":true,"finance":true,"insights":true,"max_active_orders":1000}'
)
on conflict (code) do update set
  name = excluded.name,
  per_delivery_margin = 0,
  features = excluded.features,
  active = true;
