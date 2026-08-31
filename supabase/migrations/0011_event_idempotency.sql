-- =========================================================
-- LEEVA — FASE 2 — idempotência de eventos "uma vez por pedido"
--
-- delivery.accepted e delivery.nearby só podem existir uma vez por pedido.
-- O índice único parcial garante isso no banco (o check no código era
-- read-then-write e corria).
-- =========================================================

-- limpa duplicados pré-existentes, mantendo o mais antigo
delete from public.order_events e
using (
  select order_id, type, min(id) as keep
  from public.order_events
  where type in ('delivery.accepted', 'delivery.nearby')
  group by order_id, type
  having count(*) > 1
) d
where e.order_id = d.order_id and e.type = d.type and e.id <> d.keep;

create unique index order_events_once_idx
  on public.order_events(order_id, type)
  where type in ('delivery.accepted', 'delivery.nearby');
