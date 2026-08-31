-- =========================================================
-- LEEVA — correção do trigger de status
--
-- Problema: o trigger original rodava BEFORE INSERT e já tentava
-- gravar em order_status_history usando NEW.id — mas a linha do
-- pedido ainda não existe nesse momento, quebrando a foreign key.
--
-- Solução: separar em dois triggers
--   * BEFORE INSERT/UPDATE  -> só preenche as colunas de milestone em NEW
--   * AFTER  INSERT/UPDATE  -> grava o histórico (a linha já existe)
-- =========================================================

drop trigger if exists trg_orders_status_log on public.orders;
drop function if exists public.log_order_status_change();

-- BEFORE: preenche o milestone correspondente ao status
create or replace function public.fill_order_milestone()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'preparing' then new.preparing_at = coalesce(new.preparing_at, now());
      when 'ready'     then new.ready_at     = coalesce(new.ready_at, now());
      when 'assigned'  then new.assigned_at  = coalesce(new.assigned_at, now());
      when 'picked_up' then new.picked_up_at = coalesce(new.picked_up_at, now());
      when 'in_route'  then new.in_route_at  = coalesce(new.in_route_at, now());
      when 'delivered' then new.delivered_at = coalesce(new.delivered_at, now());
      when 'cancelled' then new.cancelled_at = coalesce(new.cancelled_at, now());
      else null;
    end case;
  end if;
  return new;
end $$;

create trigger trg_orders_fill_milestone
  before insert or update on public.orders
  for each row execute function public.fill_order_milestone();

-- AFTER: registra a transição no histórico
create or replace function public.log_order_status_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, restaurant_id, from_status, to_status, changed_by)
    values (new.id, new.restaurant_id, null, new.status, auth.uid());
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.order_status_history (order_id, restaurant_id, from_status, to_status, changed_by)
    values (new.id, new.restaurant_id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger trg_orders_status_log
  after insert or update on public.orders
  for each row execute function public.log_order_status_change();
