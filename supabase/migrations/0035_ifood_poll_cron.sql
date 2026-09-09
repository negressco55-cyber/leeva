-- =========================================================
-- LEEVA — cron do polling do iFood (pg_cron + pg_net)
-- =========================================================
-- O iFood NÃO manda webhook — a gente busca os pedidos de tempos em tempos.
-- Mesmo padrão do dispatch-tick (0014): a URL fica no Vault, nunca aqui.
-- Só liga quando a integração iFood estiver homologada e no ar.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_ifood_poll()
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'leeva_ifood_poll_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'leeva_cron_secret';
  if v_url is null or v_secret is null then
    return; -- ainda não configurado
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body    := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 20000
  );
end $$;

-- Rodar UMA vez em produção depois que o iFood estiver ligado:
--   select public.configure_ifood_poll_cron(
--     'https://leeva-restaurante.vercel.app/api/cron/ifood-poll',
--     'MESMO-VALOR-DE-CRON_SECRET',
--     '30 seconds');
create or replace function public.configure_ifood_poll_cron(
  p_target_url text, p_secret text, p_schedule text default '30 seconds'
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  jid bigint;
begin
  delete from vault.secrets where name = 'leeva_ifood_poll_url';
  perform vault.create_secret(p_target_url, 'leeva_ifood_poll_url', 'URL do endpoint /api/cron/ifood-poll');
  -- reaproveita leeva_cron_secret; recria se ainda não existir
  if not exists (select 1 from vault.decrypted_secrets where name = 'leeva_cron_secret') then
    perform vault.create_secret(p_secret, 'leeva_cron_secret', 'valor de CRON_SECRET da aplicação');
  end if;

  if exists (select 1 from cron.job where jobname = 'leeva-ifood-poll') then
    perform cron.unschedule('leeva-ifood-poll');
  end if;
  select cron.schedule('leeva-ifood-poll', p_schedule, 'select public.trigger_ifood_poll()') into jid;
  return 'agendado job ' || jid || ' (' || p_schedule || ')';
end $$;

comment on function public.configure_ifood_poll_cron is
  'Rodar UMA vez, depois do iFood homologado, com a URL de /api/cron/ifood-poll e o CRON_SECRET.';
