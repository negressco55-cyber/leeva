-- =========================================================
-- LEEVA — comprovação de entrega (GPS + foto)
-- =========================================================
-- Ao confirmar "Entreguei", o app do motoboy manda a localização e uma foto.
--   delivery_gps_status: 'ok'   = estava perto (<= raio)
--                        'far'  = longe demais (bloqueado, não chega aqui)
--                        'no_gps' = sem localização (permitido, mas sinalizado)

alter table public.orders
  add column if not exists delivered_lat        numeric,
  add column if not exists delivered_lng        numeric,
  add column if not exists delivery_distance_m  integer,
  add column if not exists delivery_gps_status  text,
  add column if not exists delivery_photo_path  text;

-- Bucket privado para as fotos de comprovação. Upload/leitura só via
-- service_role (rotas server-side) — nada de acesso direto do navegador.
insert into storage.buckets (id, name, public)
values ('delivery-proof', 'delivery-proof', false)
on conflict (id) do nothing;
