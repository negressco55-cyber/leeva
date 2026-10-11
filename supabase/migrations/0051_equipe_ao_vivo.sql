-- =========================================================
-- LEEVA — equipe própria sempre visível no mapa
-- =========================================================
-- Modelo novo (10/10): só mensalidade, o estabelecimento usa os PRÓPRIOS
-- motoboys. O dono precisa ver a equipe em tempo real mesmo quando o
-- motoboy está parado esperando entrega (não só durante a entrega).
--
-- record_my_location(): se o motoboy é da frota própria (fleet='own'),
-- está online e não tem entrega ativa, a posição é gravada para o
-- restaurante dele (order_id NULL). O resto da função não muda.
-- Os apps (PWA e nativo) já mandam a posição enquanto o motoboy está
-- online, então não precisa de APK novo.

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
  v_fleet   public.driver_fleet;
  v_home    uuid;
  v_status  public.motoboy_status;
  v_order   record;
  v_dist_m  double precision;
  v_nearby  boolean := false;
begin
  select id, fleet, restaurant_id, status into v_motoboy, v_fleet, v_home, v_status
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
    -- sem entrega: motoboy da EQUIPE PRÓPRIA online continua visível pro
    -- estabelecimento dele (frota própria = o restaurante é o patrão).
    -- Motoboy da rede Leeva sem entrega segue invisível (privacidade).
    if v_fleet = 'own' and v_home is not null and v_status <> 'offline' then
      insert into public.driver_locations
        (restaurant_id, motoboy_id, order_id, latitude, longitude, accuracy, speed)
      values (
        v_home, v_motoboy, null, p_latitude, p_longitude,
        case when p_accuracy is not null and p_accuracy <> 'NaN'::double precision
                  and p_accuracy >= 0 then p_accuracy end,
        case when p_speed is not null and p_speed <> 'NaN'::double precision
                  and p_speed >= 0 then p_speed end
      );
      return jsonb_build_object('ok', true, 'stored', true, 'idle', true);
    end if;
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
