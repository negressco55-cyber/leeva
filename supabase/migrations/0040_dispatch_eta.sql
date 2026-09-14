-- Bloco 2 do despacho sincronizado: tempo até a coleta (por candidato, posição
-- real) e tempo da coleta até a entrega (rota real), gravados na oferta para
-- serem a fonte única exibida ao motoboy — nunca recalculados em outra camada.
alter table public.dispatch_attempts
  add column if not exists eta_pickup_min integer,
  add column if not exists eta_dropoff_min integer;
