-- =========================================================
-- LEEVA — FASE 2 — hardening (auditoria)
--
-- 1. unique(customers.restaurant_id, phone) — evita clientes duplicados
--    em corrida e habilita upsert por telefone.
-- 2. CHECK de coordenadas plausíveis em orders / motoboys / driver_locations.
-- 3. CHECK de valores monetários não-negativos.
-- 4. índices que faltavam para as queries de auditoria/indicadores.
-- =========================================================

-- --- 1. clientes únicos por telefone dentro do restaurante ---
-- primeiro consolida eventuais duplicados já existentes
with dups as (
  select restaurant_id, phone, min(id::text)::uuid as keep_id, array_agg(id) as ids
  from public.customers
  where phone is not null
  group by restaurant_id, phone
  having count(*) > 1
)
update public.orders o
set customer_id = d.keep_id
from dups d
where o.customer_id = any(d.ids) and o.customer_id <> d.keep_id;

delete from public.customers c
using (
  select restaurant_id, phone, min(id::text)::uuid as keep_id
  from public.customers where phone is not null
  group by restaurant_id, phone having count(*) > 1
) d
where c.restaurant_id = d.restaurant_id and c.phone = d.phone and c.id <> d.keep_id;

create unique index if not exists customers_restaurant_phone_key
  on public.customers(restaurant_id, phone) where phone is not null;

-- --- 2. coordenadas plausíveis ---
alter table public.orders
  add constraint orders_lat_range check (latitude is null or (latitude between -90 and 90)),
  add constraint orders_lng_range check (longitude is null or (longitude between -180 and 180));

alter table public.motoboys
  add constraint motoboys_lat_range check (current_latitude is null or (current_latitude between -90 and 90)),
  add constraint motoboys_lng_range check (current_longitude is null or (current_longitude between -180 and 180));

alter table public.restaurants
  add constraint restaurants_lat_range check (latitude is null or (latitude between -90 and 90)),
  add constraint restaurants_lng_range check (longitude is null or (longitude between -180 and 180));

alter table public.driver_locations
  add constraint driver_loc_lat_range check (latitude between -90 and 90),
  add constraint driver_loc_lng_range check (longitude between -180 and 180);

-- --- 3. valores monetários ---
alter table public.orders
  add constraint orders_amount_nonneg check (order_amount >= 0),
  add constraint orders_fee_nonneg check (delivery_fee >= 0);

alter table public.order_items
  add constraint order_items_price_nonneg check (unit_price >= 0);

-- --- 4. índices para performance em escala ---
create index if not exists orders_motoboy_status_idx
  on public.orders(motoboy_id, status) where motoboy_id is not null;
create index if not exists orders_delivered_at_idx
  on public.orders(restaurant_id, delivered_at) where delivered_at is not null;
create index if not exists notifications_order_template_idx
  on public.notifications(order_id, template);
