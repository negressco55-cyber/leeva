-- Fase 5 Bloco C — ajuste de crédito com valor COM SINAL.
--
-- credit_add só aceita valor positivo. O agrupamento precisa devolver
-- crédito (quando a rota agrupada sai mais barata) e voltar a cobrar
-- (quando o grupo é desfeito). credit_adjust cobre os dois casos, com
-- piso em zero, e registra no ledger como 'adjustment'.

create or replace function public.credit_adjust(
  p_restaurant_id uuid,
  p_amount        numeric,   -- pode ser negativo
  p_description   text
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal numeric;
begin
  if p_amount is null or p_amount = 0 then
    select balance into v_bal from public.restaurant_credits where restaurant_id = p_restaurant_id;
    return coalesce(v_bal, 0);
  end if;

  insert into public.restaurant_credits (restaurant_id, balance)
    values (p_restaurant_id, greatest(0, p_amount))
  on conflict (restaurant_id)
    do update set balance = greatest(0, public.restaurant_credits.balance + p_amount), updated_at = now()
  returning balance into v_bal;

  insert into public.credit_ledger (restaurant_id, kind, amount, balance_after, description)
    values (p_restaurant_id, 'adjustment', p_amount, v_bal, p_description);

  return v_bal;
end;
$$;

grant execute on function public.credit_adjust(uuid, numeric, text) to service_role;
