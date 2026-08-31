-- =========================================================
-- LEEVA — FASE 2 — ajuste do índice único de alerts
--
-- O índice parcial (where active) não serve para ON CONFLICT via a API
-- do Supabase. Trocamos por um único simples em (restaurant_id, key):
-- passa a existir no máximo 1 linha por chave, alternando active on/off.
-- =========================================================

drop index if exists public.alerts_restaurant_key_active_idx;

create unique index alerts_restaurant_key_idx
  on public.alerts(restaurant_id, key);
