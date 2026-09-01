-- Fase 5 Bloco B — Web Push (PWA) para o app do motoboy.
-- Guarda a "subscription" que o navegador gera quando o motoboy autoriza
-- notificações. Um motoboy pode ter vários dispositivos.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references motoboys(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  failure_count integer not null default 0
);

create index if not exists push_subscriptions_motoboy_idx on push_subscriptions (motoboy_id);

alter table push_subscriptions enable row level security;

-- só o serviço (service role) mexe nisso; o app fala via API route com adminDb.
drop policy if exists "push: service only" on push_subscriptions;
create policy "push: service only" on push_subscriptions
  for all using (false) with check (false);

-- preferências de notificação do motoboy (default: tudo ligado depois que autoriza)
alter table motoboys add column if not exists push_enabled boolean not null default false;
