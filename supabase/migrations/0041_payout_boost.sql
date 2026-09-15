-- Despacho natural: sem limite de tentativas, o restaurante pode reforçar
-- (opcionalmente) o valor pago ao motoboy num pedido específico que está
-- demorando a encontrar entregador, pra atrair alguém mais rápido.
alter table public.orders
  add column if not exists payout_boost numeric(10,2);
