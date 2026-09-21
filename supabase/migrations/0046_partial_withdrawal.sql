-- Saque parcial: o resto do ganho que sobra fica na carteira como um ganho
-- avulso, sem pedido de origem (order_id nulo). O unique(order_id) continua
-- valendo pros ganhos normais (nulos não colidem).
alter table public.driver_earnings alter column order_id drop not null;

-- Pedidos do iFood lançados manualmente: localizador de 8 dígitos (pra
-- confirmação de entrega própria no site do iFood) e quando o motoboy
-- marcou que confirmou por lá.
alter table public.orders
  add column if not exists ifood_locator text,
  add column if not exists ifood_confirmed_at timestamptz;
