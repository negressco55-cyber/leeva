-- =========================================================
-- LEEVA — FASE 2 — corrige a geração do token de rastreamento
--
-- Problema: create_tracking_token() usava gen_random_bytes() (pgcrypto),
-- que no Supabase fica no schema `extensions` e não era encontrado por
-- causa do search_path da função SECURITY DEFINER — quebrando TODO insert
-- em orders.
--
-- Solução: gerar o token com gen_random_uuid() (pg_catalog, sempre
-- disponível), concatenando dois UUIDs sem hífens = 64 chars hex.
-- =========================================================

create or replace function public.create_tracking_token()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tracking_tokens (restaurant_id, order_id, token, expires_at)
  values (
    new.restaurant_id,
    new.id,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    now() + interval '2 days'
  )
  on conflict do nothing;
  return new;
end $$;
