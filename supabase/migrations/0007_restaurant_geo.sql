-- =========================================================
-- LEEVA — FASE 2 — coordenadas e configurações do restaurante
-- =========================================================

alter table public.restaurants
  add column latitude   double precision,
  add column longitude  double precision,
  add column settings   jsonb not null default '{}'::jsonb;

-- Coordenada padrão de João Pboa/PB (centro) só para não ficar nulo em
-- ambiente de desenvolvimento; o restaurante ajusta nas configurações.
-- (não é dado "falso" de operação — é o ponto de coleta do estabelecimento)
comment on column public.restaurants.latitude is
  'Ponto de coleta do restaurante. Usado pelo motor de despacho.';
