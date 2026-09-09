-- =========================================================
-- LEEVA — "o restaurante decide" quais pedidos vão pro Leeva
-- =========================================================
-- Pedidos importados de integração (iFood) podem entrar "segurados": aparecem
-- no painel e no mapa, mas NÃO são despachados nem descontam crédito até o
-- restaurante clicar "Chamar entregador". Controlado por
-- restaurants.logistics_config.ifood_auto_call (default true = automático).

alter table public.orders
  add column if not exists dispatch_hold boolean not null default false;

-- índice parcial: o despacho ignora os segurados
create index if not exists orders_dispatch_hold_idx
  on public.orders (restaurant_id) where dispatch_hold;
