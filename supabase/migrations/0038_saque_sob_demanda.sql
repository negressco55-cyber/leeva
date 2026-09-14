-- =========================================================
-- LEEVA — saque do motoboy sob demanda (substitui o fechamento
-- automático diário) + registro de saques que o Leeva faz da própria
-- margem (pra saber exatamente quanto já tirou).
-- =========================================================

-- Desliga o cron automático de fechamento diário, se algum dia foi
-- agendado (idempotente — não dá erro se nunca foi). Repasse agora é
-- só por solicitação do motoboy (requestPayout), 1x por dia — a própria
-- unique(motoboy_id, period_date) de payout_batches já garante o limite.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'leeva-payout-closing') then
    perform cron.unschedule('leeva-payout-closing');
  end if;
exception when undefined_table then
  null; -- extensão pg_cron não habilitada — nada a desligar
end $$;

-- Saques que o Leeva já fez da própria margem acumulada (registro manual
-- — a transferência de verdade é feita por fora, no painel da Asaas; isto
-- aqui é só o livro-razão pra saber quanto já foi tirado).
create table if not exists public.platform_withdrawals (
  id          uuid primary key default gen_random_uuid(),
  amount      numeric(12,2) not null check (amount > 0),
  description text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.platform_withdrawals enable row level security;
create policy "platform_withdrawals: admin lê e escreve" on public.platform_withdrawals
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
