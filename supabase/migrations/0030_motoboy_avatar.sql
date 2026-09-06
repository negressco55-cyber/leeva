-- Foto de perfil do entregador. Nula até haver upload.
-- Quando a verificação facial for ligada (ver docs/VERIFICACAO-DE-IDENTIDADE.md),
-- a selfie aprovada no liveness vira a foto de perfil.

alter table motoboys
  add column if not exists avatar_url text;
