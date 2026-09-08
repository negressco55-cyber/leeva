-- =========================================================
-- LEEVA — taxa de saque no repasse ao motoboy
-- =========================================================
-- A Asaas cobra por transferência Pix. Como o repasse é 1x/dia por motoboy,
-- a taxa é descontada do valor do repasse (o motoboy sabe disso de antemão).
--   amount        = total ganho no período (não muda)
--   transfer_fee  = taxa da Asaas nesse saque
--   valor no Pix  = amount − transfer_fee

alter table public.payout_batches
  add column if not exists transfer_fee numeric(10,2) not null default 0;
