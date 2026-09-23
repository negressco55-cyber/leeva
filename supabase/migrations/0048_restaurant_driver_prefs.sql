-- Preferência do restaurante sobre um motoboy específico:
--   'favorite' → prioridade no despacho (bônus no score)
--   'blocked'  → nunca recebe oferta de pedidos desse restaurante
-- Um motoboy tem no máximo uma preferência por restaurante (favorito OU bloqueado).
create table public.restaurant_driver_prefs (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  motoboy_id    uuid not null references public.motoboys(id) on delete cascade,
  kind          text not null check (kind in ('favorite', 'blocked')),
  created_at    timestamptz not null default now(),
  unique (restaurant_id, motoboy_id)
);

create index restaurant_driver_prefs_restaurant_idx on public.restaurant_driver_prefs(restaurant_id, kind);
create index restaurant_driver_prefs_motoboy_idx on public.restaurant_driver_prefs(motoboy_id);

alter table public.restaurant_driver_prefs enable row level security;

-- o restaurante só vê/mexe nas próprias preferências
create policy "restaurant_driver_prefs: equipe gerencia as do restaurante"
  on public.restaurant_driver_prefs for all
  using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

comment on table public.restaurant_driver_prefs is
  'Favorito (prioridade no despacho) ou bloqueado (nunca recebe oferta) por restaurante.';
