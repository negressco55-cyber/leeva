-- Plano "Parceiro teste" — sem mensalidade e sem margem do Leeva por entrega.
-- O restaurante paga só o valor do motoboy (distância) e a taxa Pix real do
-- Asaas quando compra crédito (já cobrada à parte em credit-purchase.ts).
-- Uso: restaurantes convidados por nós para testar sem custo do Leeva.
insert into public.plans (code, name, monthly_price, per_delivery_price, per_delivery_margin, trial_days, sort_order, active, features)
values (
  'partner_zero',
  'Parceiro teste',
  0,
  0,
  0,
  3650, -- não expira sozinho; tirar do trial é manual
  0,
  false, -- ESCONDIDO: não aparece na escolha de plano; atribuído à mão
  '{"auto_dispatch":true,"map":true,"tracking":true,"heatmap":true,"grouping":true,"own_fleet":true,"leeva_network":true,"api":true,"finance":true,"insights":true,"max_active_orders":1000}'
)
on conflict (code) do update set
  monthly_price = excluded.monthly_price,
  per_delivery_price = excluded.per_delivery_price,
  per_delivery_margin = excluded.per_delivery_margin,
  active = false;

-- Enquanto a mensalidade não é cobrada de verdade (billing.ts só exibe),
-- só o plano sem mensalidade fica visível; Pro/Scale dariam margem menor
-- por entrega sem cobrar nada. Aplicado em produção em 2026-09-23.
update public.plans set name = 'Livre', monthly_price = 0, per_delivery_margin = 1.00 where code = 'start';
update public.plans set active = false where code in ('pro', 'business');
