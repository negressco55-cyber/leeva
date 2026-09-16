-- =========================================================
-- LEEVA — chat restaurante <-> motoboy, por pedido
-- =========================================================
-- Mensagens de texto simples, trocadas só enquanto o pedido está com um
-- entregador atribuído. Leitura/escrita sempre pelo servidor (service_role)
-- depois de validar que quem está chamando (dono do pedido ou o motoboy
-- atribuído) tem acesso — sem policy de cliente direta, mais simples de
-- manter correto.

create table if not exists public.order_messages (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  sender_type   text not null check (sender_type in ('restaurant', 'motoboy')),
  sender_id     uuid not null,
  body          text not null check (char_length(body) between 1 and 1000),
  created_at    timestamptz not null default now()
);

create index if not exists order_messages_order_idx on public.order_messages(order_id, created_at);

alter table public.order_messages enable row level security;
-- admin da plataforma pode ler tudo (suporte/auditoria) — o resto passa pelo
-- servidor com service_role, que ignora RLS.
drop policy if exists "order_messages: admin lê todos" on public.order_messages;
create policy "order_messages: admin lê todos" on public.order_messages
  for select using (public.is_platform_admin());
