-- =========================================================
-- LEEVA — "ao vivo" sem passar pela Vercel
-- =========================================================
-- 1. record_my_location(): o app do motoboy grava a própria posição
--    DIRETO no Supabase (antes era POST /api/location na Vercel a cada
--    8–20s por motoboy — o que mais pesava no plano). Mesma regra da rota:
--    só grava com entrega ativa, e a posição pertence ao restaurante da
--    entrega. O painel do restaurante recebe pelo Realtime
--    (driver_locations já está na publicação desde a 0006).
--
--    O aviso "seu pedido está chegando" (delivery.nearby) continua no
--    servidor: a função só devolve nearby=true quando o motoboy entra no
--    raio de 400 m, e aí o app chama /api/location UMA vez por entrega.
--
-- 2. order_messages no Realtime: chat do pedido deixa de fazer polling
--    a cada 5s. Leitura liberada só para quem já tinha acesso pela API
--    (equipe do restaurante do pedido e o motoboy atribuído). Escrita
--    continua só pelo servidor.
-- =========================================================

-- --- 1. localização direta ---------------------------------------------
create or replace function public.record_my_location(
  p_latitude  double precision,
  p_longitude double precision,
  p_accuracy  double precision default null,
  p_speed     double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motoboy uuid;
  v_order   record;
  v_dist_m  double precision;
  v_nearby  boolean := false;
begin
  select id into v_motoboy
    from public.motoboys
   where user_id = auth.uid() and active
   limit 1;
  if v_motoboy is null then
    return jsonb_build_object('ok', false, 'error', 'sem acesso');
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude  = 'NaN'::double precision or p_longitude = 'NaN'::double precision
     or p_latitude  not between -90  and 90
     or p_longitude not between -180 and 180 then
    return jsonb_build_object('ok', false, 'error', 'coordenada inválida');
  end if;

  select o.id, o.restaurant_id, o.status, o.latitude, o.longitude
    into v_order
    from public.orders o
   where o.motoboy_id = v_motoboy
     and o.status in ('assigned', 'picked_up', 'in_route')
   order by o.assigned_at asc nulls last
   limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'stored', false);
  end if;

  insert into public.driver_locations
    (restaurant_id, motoboy_id, order_id, latitude, longitude, accuracy, speed)
  values (
    v_order.restaurant_id, v_motoboy, v_order.id, p_latitude, p_longitude,
    case when p_accuracy is not null and p_accuracy <> 'NaN'::double precision
              and p_accuracy >= 0 then p_accuracy end,
    case when p_speed is not null and p_speed <> 'NaN'::double precision
              and p_speed >= 0 then p_speed end
  );

  -- perto do cliente (< 400 m) e o aviso ainda não saiu?
  if v_order.status = 'in_route'
     and v_order.latitude is not null and v_order.longitude is not null then
    v_dist_m := 2 * 6371000 * asin(sqrt(
        power(sin(radians(v_order.latitude - p_latitude) / 2), 2)
      + cos(radians(p_latitude)) * cos(radians(v_order.latitude))
      * power(sin(radians(v_order.longitude - p_longitude) / 2), 2)
    ));
    if v_dist_m < 400 and not exists (
      select 1 from public.order_events
       where order_id = v_order.id and type = 'delivery.nearby'
    ) then
      v_nearby := true;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true, 'stored', true, 'order_id', v_order.id, 'nearby', v_nearby
  );
end $$;

revoke all on function public.record_my_location(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.record_my_location(double precision, double precision, double precision, double precision) to authenticated;

-- --- 2. chat do pedido ao vivo ------------------------------------------
drop policy if exists "order_messages: equipe lê do restaurante" on public.order_messages;
create policy "order_messages: equipe lê do restaurante" on public.order_messages
  for select using (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() in ('restaurant_owner', 'restaurant_staff')
  );

drop policy if exists "order_messages: motoboy lê da entrega dele" on public.order_messages;
create policy "order_messages: motoboy lê da entrega dele" on public.order_messages
  for select using (
    order_id in (select id from public.orders where motoboy_id = public.current_motoboy_id())
  );

alter table public.order_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_messages'
  ) then
    alter publication supabase_realtime add table public.order_messages;
  end if;
end $$;
