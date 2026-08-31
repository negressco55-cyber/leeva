-- =========================================================
-- LEEVA — FASE 3.5 — Reputação e inteligência do motoboy
--
-- - Qualidade da oferta (classificada ANTES de enviar): excellent/good/acceptable/poor.
-- - Aceitação JUSTA: recusar oferta "poor" NÃO penaliza. Só ofertas adequadas
--   (excellent/good) contam contra a taxa de aceitação.
-- - Índice de confiabilidade: combinação de aceitação, finalização, pontualidade,
--   avaliação e incidentes. Pesos CONFIGURÁVEIS. Nenhum indicador domina.
-- - Incidentes com motivo e ORIGEM (driver/restaurant/customer/system) —
--   problema do restaurante/cliente/sistema NÃO penaliza o motoboy.
-- =========================================================

create type offer_quality  as enum ('excellent', 'good', 'acceptable', 'poor');
create type incident_type   as enum (
  'decline_adequate_offer',  -- recusou oferta adequada (impacto leve na aceitação)
  'cancel_after_accept',     -- aceitou e cancelou sem motivo válido
  'abandon',                 -- aceitou e abandonou
  'no_show',                 -- não compareceu à coleta
  'late_delivery',           -- entregou muito além do ETA
  'complaint'                -- reclamação registrada
);
create type incident_origin as enum ('driver', 'restaurant', 'customer', 'system', 'unknown');

-- ---------------------------------------------------------
-- DISPATCH ATTEMPTS — qualidade da oferta
-- ---------------------------------------------------------
alter table public.dispatch_attempts
  add column quality              offer_quality,
  add column quality_score        numeric(6,2),               -- 0..100
  add column quality_factors      jsonb not null default '{}'::jsonb,
  add column counts_for_acceptance boolean not null default false,  -- true => recusa penaliza aceitação
  add column payout_estimate      numeric(10,2),
  add column distance_pickup_km   numeric(8,2),
  add column distance_total_km    numeric(8,2);

-- ---------------------------------------------------------
-- DRIVER INCIDENTS — ocorrências operacionais com origem
-- ---------------------------------------------------------
create table public.driver_incidents (
  id            uuid primary key default gen_random_uuid(),
  motoboy_id    uuid not null references public.motoboys(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  order_id      uuid references public.orders(id) on delete set null,
  type          incident_type not null,
  origin        incident_origin not null default 'unknown',
  -- severidade relativa (0..1). Origem != 'driver' entra com peso 0 no índice.
  severity      numeric(4,2) not null default 1.0,
  note          text,
  created_at    timestamptz not null default now()
);
create index driver_incidents_motoboy_idx on public.driver_incidents(motoboy_id, created_at desc);
create index driver_incidents_order_idx on public.driver_incidents(order_id);

-- ---------------------------------------------------------
-- MOTOBOYS — métricas de reputação (0..100) + bloqueio
-- ---------------------------------------------------------
alter table public.motoboys
  add column offers_adequate           integer not null default 0,
  add column offers_adequate_accepted  integer not null default 0,
  add column acceptance_rate           numeric(5,2) not null default 100,   -- % ofertas adequadas aceitas
  add column completion_rate_pct       numeric(5,2) not null default 100,   -- % aceitas concluídas
  add column punctuality_rate          numeric(5,2) not null default 100,   -- % concluídas no prazo
  add column reliability_index         numeric(5,2) not null default 100,   -- índice geral 0..100
  add column reputation_updated_at     timestamptz,
  add column blocked                   boolean not null default false,
  add column blocked_reason            text;

-- ---------------------------------------------------------
-- REPUTATION CONFIG — pesos e limiares (linha única global)
-- ---------------------------------------------------------
create table public.reputation_config (
  id          integer primary key default 1,
  config      jsonb not null default '{
    "weights": { "acceptance": 20, "completion": 30, "punctuality": 20, "rating": 15, "incidents": 15 },
    "acceptance_soft_impact": 0.5,
    "incident_penalty": { "decline_adequate_offer": 3, "cancel_after_accept": 15, "abandon": 25, "no_show": 20, "late_delivery": 5, "complaint": 8 },
    "incident_window_days": 30,
    "sla_minutes": 55,
    "block_threshold": 45,
    "min_sample": 5
  }'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint reputation_config_singleton check (id = 1)
);
insert into public.reputation_config (id) values (1);
create trigger trg_reputation_config_updated before update on public.reputation_config
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- Trigger: mantém contadores brutos de ofertas adequadas ao responder.
-- (o índice em si é recalculado pela aplicação — reputation.ts)
-- ---------------------------------------------------------
create or replace function public.track_offer_acceptance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.responded_at is not null and old.responded_at is null
     and new.counts_for_acceptance then
    if new.outcome = 'accepted' then
      update public.motoboys set
        offers_adequate = offers_adequate + 1,
        offers_adequate_accepted = offers_adequate_accepted + 1
      where id = new.motoboy_id;
    elsif new.outcome in ('declined', 'timeout') then
      update public.motoboys set offers_adequate = offers_adequate + 1
      where id = new.motoboy_id;
      -- recusa/expiração de oferta adequada = incidente leve
      insert into public.driver_incidents (motoboy_id, restaurant_id, order_id, type, origin, severity, note)
      values (new.motoboy_id, new.restaurant_id, new.order_id, 'decline_adequate_offer', 'driver',
              case when new.outcome = 'timeout' then 0.5 else 1.0 end,
              'oferta ' || coalesce(new.quality::text,'?') || ' não aceita (' || new.outcome::text || ')');
    end if;
  end if;
  return new;
end $$;

create trigger trg_dispatch_attempts_acceptance
  after update on public.dispatch_attempts
  for each row execute function public.track_offer_acceptance();

comment on column public.dispatch_attempts.counts_for_acceptance is
  'TRUE apenas para ofertas classificadas como excellent/good. Recusar oferta poor NUNCA penaliza.';
