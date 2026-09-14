-- Reaplica a coluna de foto de perfil (migration 0030), que nunca foi
-- rodada no banco — idempotente, seguro mesmo se 0030 já tiver sido
-- aplicada. Guarda o CAMINHO no storage (bucket driver-documents), não uma
-- URL pública — é dado sensível (rosto), a URL é assinada na hora de exibir.

alter table motoboys
  add column if not exists avatar_url text;
