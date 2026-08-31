-- =========================================================
-- LEEVA — FASE 3.5 — Chaves de API por restaurante
--
-- Substitui a dependência da LEEVA_API_KEY global. Cada restaurante
-- gera as próprias chaves. Guardamos só o HASH (sha-256). A chave em
-- claro aparece UMA vez, na criação.
-- =========================================================

create table public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null default 'Chave de API',
  key_hash      text not null unique,        -- sha256 hex da chave
  last4         text not null,               -- últimos 4 caracteres (exibição)
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);
create index api_keys_restaurant_idx on public.api_keys(restaurant_id) where revoked_at is null;

alter table public.api_keys enable row level security;

-- o dono gerencia as chaves do próprio restaurante
create policy "api_keys: dono gerencia as do restaurante" on public.api_keys
  for all
  using (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() = 'restaurant_owner')
  with check (restaurant_id = public.current_restaurant_id()
         and public.current_user_role() = 'restaurant_owner');

-- admin da plataforma vê todas (suporte)
create policy "api_keys: admin lê todas" on public.api_keys
  for select using (public.is_platform_admin());

-- a validação de chave na borda usa service_role (ignora RLS).
