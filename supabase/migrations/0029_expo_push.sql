-- App nativo do motoboy (Expo/React Native) — push por Expo Push Service.
-- Reaproveita push_subscriptions: kind distingue 'web' (VAPID) de 'expo'.
-- Para 'expo', o token fica em `endpoint` e p256dh/auth não se aplicam.

alter table push_subscriptions
  add column if not exists kind text not null default 'web';

alter table push_subscriptions
  alter column p256dh drop not null,
  alter column auth drop not null;

alter table push_subscriptions
  drop constraint if exists push_subscriptions_kind_check;
alter table push_subscriptions
  add constraint push_subscriptions_kind_check check (kind in ('web', 'expo'));
