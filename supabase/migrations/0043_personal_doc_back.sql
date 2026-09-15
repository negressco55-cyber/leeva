-- CNH/RG passa a pedir frente e verso — coluna nova pro verso (frente já
-- existia em personal_doc_path).
alter table public.motoboys
  add column if not exists personal_doc_back_path text;
