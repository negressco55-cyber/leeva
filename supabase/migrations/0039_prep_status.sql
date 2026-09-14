-- =========================================================
-- LEEVA — status de preparo visível pro motoboy (Bloco 1)
-- =========================================================
-- prep_estimate_minutes: quanto tempo o restaurante estima levar pra ficar
-- pronto, informado (ou padrão configurável) no momento de marcar "em
-- preparo". ready_at já existia (preenchido pelo trigger de milestone) —
-- agora também pode ser setado diretamente por markReady() mesmo quando o
-- pedido já está com motoboy atribuído (status='assigned'), sem mexer no
-- status — é isso que mantém a entrega visível na tela do motoboy mesmo
-- depois de "pronto".

alter table public.orders
  add column if not exists prep_estimate_minutes integer;
