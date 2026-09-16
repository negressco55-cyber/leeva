-- =========================================================
-- LEEVA — alerta por e-mail se o motor de despacho parar
-- =========================================================
-- Guarda quando o último alerta foi enviado, pra não mandar e-mail a cada
-- 5 minutos enquanto o problema persiste (só de novo depois de 30min, e um
-- "voltou ao normal" quando o status se recupera).

create table if not exists public.platform_alert_state (
  key           text primary key,
  last_status   text,
  last_sent_at  timestamptz,
  updated_at    timestamptz not null default now()
);

create or replace function public.trigger_health_check()
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'leeva_healthcheck_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'leeva_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
    body    := jsonb_build_object('source','pg_cron'),
    timeout_milliseconds := 20000
  );
end $$;

-- Rodar UMA vez em produção (ver docs/DEPLOY.md):
--   select public.configure_health_check_cron('https://SEU-APP/api/cron/health-check');
create or replace function public.configure_health_check_cron(
  p_target_url text, p_schedule text default '*/5 * * * *'
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare jid bigint;
begin
  delete from vault.secrets where name = 'leeva_healthcheck_url';
  perform vault.create_secret(p_target_url, 'leeva_healthcheck_url', 'endpoint /api/cron/health-check');
  if exists (select 1 from cron.job where jobname = 'leeva-health-check') then
    perform cron.unschedule('leeva-health-check');
  end if;
  select cron.schedule('leeva-health-check', p_schedule, 'select public.trigger_health_check()') into jid;
  return 'agendado job ' || jid || ' (' || p_schedule || ')';
end $$;

comment on function public.configure_health_check_cron is
  'Rodar UMA vez com a URL de /api/cron/health-check. Usa o mesmo leeva_cron_secret.';
