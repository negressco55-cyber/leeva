-- Fase 5 Bloco C — Agrupamento de entregas com precificação incremental.
--
-- O despacho pode ofertar 2+ pedidos do mesmo restaurante, com destinos
-- próximos, como UMA rota para um único motoboy.
--
-- Preço:
--   parada 1 (lead)  = tabela cheia (base + km − free_km, ≥ mínimo)
--   parada k > 1      = max(group_stop_min, km_incremental(k-1 → k) × per_km)
--   restaurante paga por pedido = valor do motoboy daquele pedido + margem do plano
--
-- Recusa: a oferta agrupada recusada DISSOLVE o grupo — cada pedido volta
-- para o despacho individual normal (decisão documentada em DECISOES-NOTURNAS.md).

alter table orders
  add column if not exists group_sequence smallint,          -- 1 = lead
  add column if not exists group_lead boolean not null default false;

alter table dispatch_attempts
  add column if not exists group_order_ids uuid[],            -- pedidos da rota (na ordem)
  add column if not exists group_plan jsonb;                  -- [{orderId,seq,address,region,lat,lng,legKm,payout,total}]

create index if not exists orders_group_idx on orders (group_id) where group_id is not null;

-- semente das chaves de configuração de agrupamento na política global
update payout_policies
set config = config
  || jsonb_build_object('group_stop_min', 3.50)
  || jsonb_build_object('group_radius_km', 1.5)
  || jsonb_build_object('group_max_stops', 3)
where restaurant_id is null
  and not (config ? 'group_stop_min');
