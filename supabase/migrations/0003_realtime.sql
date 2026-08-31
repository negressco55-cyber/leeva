-- =========================================================
-- LEEVA — Fase 1 — Realtime
-- Publica orders e motoboys no canal de Realtime do Supabase.
-- Com RLS ligado, cada cliente só recebe eventos das linhas que
-- ele teria permissão de ler (Realtime respeita as policies).
-- =========================================================

-- REPLICA IDENTITY FULL: faz o Postgres enviar a linha inteira nos
-- eventos UPDATE/DELETE (necessário para o Realtime aplicar RLS e
-- para o cliente receber os valores antigos).
alter table public.orders   replica identity full;
alter table public.motoboys replica identity full;

-- adiciona as tabelas à publicação usada pelo Realtime
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.motoboys;
