-- =========================================================
-- LEEVA — FASE 4 (Bloco 1) — Taxa de entrega automática
--
-- Modelo:
--   valor do motoboy = base + max(0, distancia_km − free_km) × per_km,
--                      nunca abaixo de min_payout.
--   Distância = linha reta × 1,3 (fator de rua) — mesma medição do resto do sistema.
--   O restaurante paga (desconta do crédito) = valor do motoboy + margem do plano.
--   O motoboy recebe 100% do valor calculado. A margem é ADICIONAL, não desconto.
--
-- Todos os valores são configuráveis no painel admin.
-- =========================================================

-- margem do Leeva por entrega, por plano
alter table public.plans
  add column per_delivery_margin numeric(10,2) not null default 1.00;

-- reprecificação / renomeação (Starter / Pro / Scale)
update public.plans set name = 'Starter', monthly_price = 49.99, per_delivery_price = 0, per_delivery_margin = 1.50 where code = 'start';
update public.plans set name = 'Pro',     monthly_price = 99.99, per_delivery_price = 0, per_delivery_margin = 1.00 where code = 'pro';
update public.plans set name = 'Scale',   monthly_price = 150.00, per_delivery_price = 0, per_delivery_margin = 0.70 where code = 'business';

-- tabela de valores do entregador (política global — editável no admin)
update public.payout_policies
  set config = config || jsonb_build_object('base', 5.00, 'per_km', 1.50, 'free_km', 2.0, 'min_payout', 6.00),
      updated_at = now()
  where restaurant_id is null;

comment on column public.plans.per_delivery_margin is
  'Margem do Leeva por entrega (R$). Somada ao valor do motoboy = total descontado do crédito do restaurante.';
