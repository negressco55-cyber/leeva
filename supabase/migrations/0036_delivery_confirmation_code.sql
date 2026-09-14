-- =========================================================
-- LEEVA — código de confirmação de entrega
-- =========================================================
-- Mesma ideia do código que o iFood usa: um número de 4 dígitos gerado na
-- criação do pedido. O restaurante manda pro cliente (WhatsApp/telefone); o
-- motoboy precisa digitar esse código, além de foto + GPS, pra concluir a
-- entrega. Prova contato real com o cliente — uma foto sozinha não garante
-- isso (dá pra fotografar qualquer coisa perto do endereço).

alter table public.orders
  add column if not exists delivery_confirmation_code text;
