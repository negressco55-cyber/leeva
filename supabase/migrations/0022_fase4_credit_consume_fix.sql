-- =========================================================
-- LEEVA — FASE 4 — fix: credit_consume tinha coluna "balance" ambígua
-- (OUT param `balance` colidia com a coluna `restaurant_credits.balance`).
-- Renomeia os OUT params e qualifica todas as referências de coluna.
-- =========================================================

drop function if exists public.credit_consume(uuid, numeric, uuid, text);

create function public.credit_consume(
  p_restaurant_id uuid,
  p_amount        numeric,
  p_order_id      uuid,
  p_description   text
) returns table(allowed boolean, new_balance numeric)
language plpgsql security definer set search_path = public as $$
declare v_bal numeric;
begin
  if exists (select 1 from public.credit_ledger where order_id = p_order_id and kind = 'consumption') then
    select rc.balance into v_bal from public.restaurant_credits rc where rc.restaurant_id = p_restaurant_id;
    return query select true, coalesce(v_bal, 0::numeric);
    return;
  end if;

  if p_amount is null or p_amount <= 0 then
    select rc.balance into v_bal from public.restaurant_credits rc where rc.restaurant_id = p_restaurant_id;
    return query select true, coalesce(v_bal, 0::numeric);
    return;
  end if;

  update public.restaurant_credits rc
     set balance = rc.balance - p_amount, updated_at = now()
   where rc.restaurant_id = p_restaurant_id and rc.balance >= p_amount
  returning rc.balance into v_bal;

  if not found then
    select rc.balance into v_bal from public.restaurant_credits rc where rc.restaurant_id = p_restaurant_id;
    return query select false, coalesce(v_bal, 0::numeric);
    return;
  end if;

  insert into public.credit_ledger (restaurant_id, kind, amount, balance_after, order_id, description)
    values (p_restaurant_id, 'consumption', -p_amount, v_bal, p_order_id, p_description);

  return query select true, v_bal;
end $$;
