-- =========================================================
-- LEEVA — FASE 4 (Bloco 4) — cron do fechamento diário de repasse
-- =========================================================

create or replace function public.trigger_payout_closing()
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'leeva_payout_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'leeva_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_secret),
    body    := jsonb_build_object('source','pg_cron'),
    timeout_milliseconds := 55000
  );
end $$;

-- Rodar UMA vez em produção (ver docs/DEPLOY.md):
--   select public.configure_payout_cron('https://SEU-APP/api/cron/payout-closing', '3 0 * * *');
create or replace function public.configure_payout_cron(
  p_target_url text, p_schedule text default '3 0 * * *'
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare jid bigint;
begin
  delete from vault.secrets where name = 'leeva_payout_url';
  perform vault.create_secret(p_target_url, 'leeva_payout_url', 'endpoint /api/cron/payout-closing');
  if exists (select 1 from cron.job where jobname = 'leeva-payout-closing') then
    perform cron.unschedule('leeva-payout-closing');
  end if;
  select cron.schedule('leeva-payout-closing', p_schedule, 'select public.trigger_payout_closing()') into jid;
  return 'agendado job ' || jid || ' (' || p_schedule || ')';
end $$;

comment on function public.configure_payout_cron is
  'Rodar UMA vez com a URL de /api/cron/payout-closing. Usa o mesmo leeva_cron_secret.';
