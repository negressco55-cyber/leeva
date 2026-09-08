/**
 * REPASSE AO MOTOBOY — Fase 4 (Bloco 4)
 *
 * O motoboy recebe 100% do valor da entrega. Pagamento em LOTE (fechamento
 * diário), uma transferência Pix por motoboy, para manter o nº de
 * transferências baixo.
 *
 * Fluxo:
 *   entrega concluída → trigger grava `driver_earnings` (ganho pendente)
 *   cron diário → closePayoutBatches() → 1 payout_batch por motoboy
 *              → processPayoutBatch() → transferência Pix (Asaas ou SIMULAÇÃO)
 *   falha → status 'failed'/'awaiting_pix' + alerta pro admin (nunca marca pago)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { getAsaasClient, pixKeyTypeToAsaas } from './asaas';
import { notifyDriver } from './notify-driver';

const money = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

async function notifyPayout(
  db: DB,
  motoboyId: string,
  outcome: 'paid' | 'failed',
  amount: number,
  fee = 0,
): Promise<void> {
  try {
    if (outcome === 'paid') {
      await notifyDriver(db, {
        motoboyId,
        kind: 'payout_paid',
        title: 'Repasse enviado',
        body:
          fee > 0
            ? `Seu repasse de ${money(amount)} (já descontada a taxa de saque de ${money(fee)}) foi enviado para sua chave Pix.`
            : `Seu repasse de ${money(amount)} foi enviado para sua chave Pix.`,
      });
    } else {
      await notifyDriver(db, {
        motoboyId,
        kind: 'payout_failed',
        title: 'Repasse não saiu',
        body: `Não conseguimos enviar seu repasse de ${money(amount)}. Confira sua chave Pix em Pagamentos — vamos tentar de novo.`,
        urgent: true,
      });
    }
  } catch {
    /* aviso nunca bloqueia o repasse */
  }
}

type DB = SupabaseClient<Database>;
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Taxa que a Asaas cobra por transferência Pix. Como o repasse é 1x por dia
 * por motoboy, é descontada do valor do repasse (o motoboy sabe disso de
 * antemão — está escrito na tela de Pagamentos). Ajustável por ambiente.
 */
export function payoutTransferFee(): number {
  const v = Number(process.env.ASAAS_TRANSFER_FEE);
  return Number.isFinite(v) && v >= 0 ? v : 1.99;
}

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
const PIX_TYPES: PixKeyType[] = ['cpf', 'cnpj', 'email', 'phone', 'random'];

/** valida e salva a chave Pix do motoboy. */
export async function setPixKey(
  db: DB,
  motoboyId: string,
  key: string,
  type: string,
): Promise<{ ok: boolean; error?: string }> {
  const k = (key ?? '').trim();
  if (k.length < 5 || k.length > 140) return { ok: false, error: 'chave Pix inválida' };
  const t = PIX_TYPES.includes(type as PixKeyType) ? (type as PixKeyType) : 'random';
  if (t === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(k)) return { ok: false, error: 'e-mail inválido' };
  if ((t === 'cpf' || t === 'phone') && k.replace(/\D/g, '').length < 10)
    return { ok: false, error: 'número incompleto' };

  const { error } = await db.from('motoboys').update({ pix_key: k, pix_key_type: t }).eq('id', motoboyId);
  if (error) return { ok: false, error: 'não foi possível salvar' };
  return { ok: true };
}

export async function getMotoboyPixInfo(db: DB, motoboyId: string) {
  const { data } = await db.from('motoboys').select('pix_key, pix_key_type').eq('id', motoboyId).maybeSingle();
  return {
    pixKey: data?.pix_key ?? null,
    pixKeyType: data?.pix_key_type ?? null,
    hasPix: !!data?.pix_key,
    // mascara para exibição
    masked: data?.pix_key ? maskPix(data.pix_key) : null,
  };
}

function maskPix(k: string): string {
  if (k.includes('@')) return k.replace(/^(.{2}).*(@.*)$/, '$1•••$2');
  if (k.length <= 6) return k;
  return `${k.slice(0, 3)}•••${k.slice(-2)}`;
}

/** total pendente de repasse do motoboy (ainda não fechado). */
export async function getPendingEarnings(db: DB, motoboyId: string): Promise<{ amount: number; count: number }> {
  const { data } = await db
    .from('driver_earnings')
    .select('amount')
    .eq('motoboy_id', motoboyId)
    .is('batch_id', null);
  const amount = round((data ?? []).reduce((s, e) => s + Number(e.amount), 0));
  return { amount, count: data?.length ?? 0 };
}

// ===========================================================================
// FECHAMENTO DIÁRIO
// ===========================================================================

export type CloseResult = {
  period: string;
  batchesCreated: number;
  paid: number;
  awaitingPix: number;
  failed: number;
  totalPaid: number;
  details: string[];
};

/** Fecha os ganhos pendentes em lotes (1 por motoboy) e processa cada um. */
export async function closePayoutBatches(
  db: DB,
  opts: { periodDate?: string; simulateOverride?: boolean } = {},
): Promise<CloseResult> {
  const period = opts.periodDate ?? new Date().toISOString().slice(0, 10);
  const res: CloseResult = {
    period,
    batchesCreated: 0,
    paid: 0,
    awaitingPix: 0,
    failed: 0,
    totalPaid: 0,
    details: [],
  };

  const { data: earnings } = await db
    .from('driver_earnings')
    .select('motoboy_id, amount')
    .is('batch_id', null)
    .limit(50000);
  if (!earnings?.length) return res;

  const byMoto = new Map<string, { total: number; count: number }>();
  for (const e of earnings) {
    const cur = byMoto.get(e.motoboy_id) ?? { total: 0, count: 0 };
    cur.total = round(cur.total + Number(e.amount));
    cur.count += 1;
    byMoto.set(e.motoboy_id, cur);
  }

  for (const [motoboyId, agg] of byMoto) {
    const { data: moto } = await db
      .from('motoboys')
      .select('full_name, pix_key, pix_key_type')
      .eq('id', motoboyId)
      .maybeSingle();

    // já existe lote hoje?
    const { data: existing } = await db
      .from('payout_batches')
      .select('id, status, amount, earnings_count')
      .eq('motoboy_id', motoboyId)
      .eq('period_date', period)
      .maybeSingle();

    if (existing && !['pending', 'awaiting_pix'].includes(existing.status)) {
      // lote já pago/processando — ganhos novos ficam pro próximo fechamento
      res.details.push(`${moto?.full_name ?? motoboyId}: lote de hoje já ${existing.status}`);
      continue;
    }

    const hasPix = !!moto?.pix_key;
    const status = hasPix ? 'pending' : 'awaiting_pix';
    let batchId: string;

    if (existing) {
      batchId = existing.id;
      await db
        .from('payout_batches')
        .update({
          amount: round(Number(existing.amount) + agg.total),
          earnings_count: existing.earnings_count + agg.count,
          status,
          pix_key: moto?.pix_key ?? null,
          pix_key_type: moto?.pix_key_type ?? null,
        })
        .eq('id', batchId);
    } else {
      const { data: created, error } = await db
        .from('payout_batches')
        .insert({
          motoboy_id: motoboyId,
          period_date: period,
          amount: agg.total,
          earnings_count: agg.count,
          status,
          pix_key: moto?.pix_key ?? null,
          pix_key_type: moto?.pix_key_type ?? null,
        })
        .select('id')
        .single();
      if (error || !created) {
        res.details.push(`${moto?.full_name ?? motoboyId}: erro ao criar lote`);
        continue;
      }
      batchId = created.id;
      res.batchesCreated += 1;
    }

    await db.from('driver_earnings').update({ batch_id: batchId }).eq('motoboy_id', motoboyId).is('batch_id', null);

    if (!hasPix) {
      res.awaitingPix += 1;
      await createPayoutAlert(db, motoboyId, batchId, `${moto?.full_name ?? 'Motoboy'} sem chave Pix cadastrada`);
      res.details.push(`${moto?.full_name ?? motoboyId}: aguardando chave Pix (R$ ${agg.total.toFixed(2)})`);
      continue;
    }

    const p = await processPayoutBatch(db, batchId, opts.simulateOverride);
    if (p.status === 'paid') {
      res.paid += 1;
      res.totalPaid = round(res.totalPaid + p.amount);
      res.details.push(`${moto?.full_name ?? motoboyId}: pago R$ ${p.amount.toFixed(2)}${p.simulated ? ' (SIMULADO)' : ''}`);
    } else {
      res.failed += 1;
      res.details.push(`${moto?.full_name ?? motoboyId}: FALHA — ${p.error ?? '?'}`);
    }
  }

  return res;
}

export type ProcessResult = {
  batchId: string;
  status: 'paid' | 'failed';
  amount: number;
  simulated: boolean;
  error?: string;
};

/** Processa UM lote: transferência Pix (Asaas) ou SIMULAÇÃO. Idempotente. */
export async function processPayoutBatch(
  db: DB,
  batchId: string,
  simulateOverride?: boolean,
): Promise<ProcessResult> {
  const { data: batch } = await db
    .from('payout_batches')
    .select('id, motoboy_id, amount, status, pix_key, pix_key_type')
    .eq('id', batchId)
    .maybeSingle();
  if (!batch) return { batchId, status: 'failed', amount: 0, simulated: false, error: 'lote não encontrado' };
  if (batch.status === 'paid')
    return { batchId, status: 'paid', amount: Number(batch.amount), simulated: false };
  if (!batch.pix_key)
    return { batchId, status: 'failed', amount: Number(batch.amount), simulated: false, error: 'sem chave Pix' };

  const amount = round(Number(batch.amount));
  if (amount <= 0) {
    await db.from('payout_batches').update({ status: 'paid', paid_at: new Date().toISOString(), amount: 0 }).eq('id', batchId);
    return { batchId, status: 'paid', amount: 0, simulated: false };
  }

  await db.from('payout_batches').update({ status: 'processing' }).eq('id', batchId);

  const asaas = getAsaasClient();
  // Trava de segurança: mesmo com a chave Asaas configurada (para a compra de
  // crédito), o repasse real ao motoboy só sai com ASAAS_PAYOUTS_ENABLED=true.
  // Assim a metade "dinheiro entrando" pode ir ao ar sem armar a "saindo".
  const payoutsLive = process.env.ASAAS_PAYOUTS_ENABLED === 'true';
  const simulate = simulateOverride ?? (!asaas || !payoutsLive);

  if (simulate) {
    await db
      .from('payout_batches')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        external_ref: 'SIMULADO',
        simulated: true,
        error: null,
      })
      .eq('id', batchId);
    await notifyPayout(db, batch.motoboy_id, 'paid', amount);
    return { batchId, status: 'paid', amount, simulated: true };
  }

  // taxa de saque da Asaas, descontada do repasse (1 saque/dia por motoboy)
  const fee = payoutTransferFee();
  const net = round(amount - fee);
  if (net < 1) {
    const msg = `valor a receber (R$ ${amount.toFixed(2)}) menor que a taxa de saque (R$ ${fee.toFixed(2)})`;
    await db.from('payout_batches').update({ status: 'failed', transfer_fee: fee, error: msg }).eq('id', batchId);
    await createPayoutAlert(db, batch.motoboy_id, batchId, msg);
    await notifyPayout(db, batch.motoboy_id, 'failed', amount);
    return { batchId, status: 'failed', amount, simulated: false, error: msg };
  }

  const r = await asaas!.transferPix({
    pixAddressKey: batch.pix_key,
    pixAddressKeyType: pixKeyTypeToAsaas(batch.pix_key_type),
    value: net,
    description: `Repasse Leeva — entregas (taxa de saque R$ ${fee.toFixed(2)})`,
  });

  if (r.ok) {
    await db
      .from('payout_batches')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        external_ref: r.data.id,
        simulated: false,
        transfer_fee: fee,
        error: null,
      })
      .eq('id', batchId);
    await notifyPayout(db, batch.motoboy_id, 'paid', net, fee);
    return { batchId, status: 'paid', amount: net, simulated: false };
  }

  await db.from('payout_batches').update({ status: 'failed', error: r.error.slice(0, 300) }).eq('id', batchId);
  await createPayoutAlert(db, batch.motoboy_id, batchId, `Transferência falhou: ${r.error}`);
  await notifyPayout(db, batch.motoboy_id, 'failed', amount);
  return { batchId, status: 'failed', amount, simulated: false, error: r.error };
}

async function createPayoutAlert(db: DB, motoboyId: string, batchId: string, message: string) {
  try {
    await db.from('error_events').insert({
      scope: 'billing',
      message: `Repasse: ${message}`.slice(0, 500),
      detail: { batch_id: batchId, motoboy_id: motoboyId },
    });
  } catch {
    /* não bloqueia o fechamento */
  }
}

// ===========================================================================
// LEITURA
// ===========================================================================

export type PayoutBatchRow = {
  id: string;
  periodDate: string;
  amount: number;
  transferFee: number;
  netAmount: number;
  earningsCount: number;
  status: string;
  simulated: boolean;
  paidAt: string | null;
  error: string | null;
};

export async function getPayoutHistory(db: DB, motoboyId: string, limit = 30): Promise<PayoutBatchRow[]> {
  const { data } = await db
    .from('payout_batches')
    .select('id, period_date, amount, transfer_fee, earnings_count, status, simulated, paid_at, error')
    .eq('motoboy_id', motoboyId)
    .order('period_date', { ascending: false })
    .limit(limit);
  return (data ?? []).map((b) => ({
    id: b.id,
    periodDate: b.period_date,
    amount: Number(b.amount),
    transferFee: Number(b.transfer_fee ?? 0),
    netAmount: round(Number(b.amount) - Number(b.transfer_fee ?? 0)),
    earningsCount: b.earnings_count,
    status: b.status,
    simulated: !!b.simulated,
    paidAt: b.paid_at,
    error: b.error,
  }));
}

export async function listPayoutBatches(
  db: DB,
  filter: { status?: string; limit?: number } = {},
) {
  let q = db
    .from('payout_batches')
    .select('id, motoboy_id, period_date, amount, transfer_fee, earnings_count, status, simulated, pix_key, pix_key_type, external_ref, error, paid_at, created_at, motoboys(full_name, fleet)')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 200);
  if (filter.status) q = q.eq('status', filter.status as Database['public']['Enums']['payout_batch_status']);
  const { data } = await q;
  return data ?? [];
}

/** admin: reprocessa um lote que falhou (depois de o motoboy corrigir a chave). */
export async function retryPayoutBatch(db: DB, batchId: string, simulateOverride?: boolean) {
  const { data: batch } = await db
    .from('payout_batches')
    .select('id, motoboy_id, status')
    .eq('id', batchId)
    .maybeSingle();
  if (!batch) return { ok: false as const, error: 'lote não encontrado' };
  if (batch.status === 'paid') return { ok: false as const, error: 'lote já pago' };

  // re-snapshot da chave atual do motoboy
  const { data: moto } = await db.from('motoboys').select('pix_key, pix_key_type').eq('id', batch.motoboy_id).maybeSingle();
  await db
    .from('payout_batches')
    .update({
      pix_key: moto?.pix_key ?? null,
      pix_key_type: moto?.pix_key_type ?? null,
      status: moto?.pix_key ? 'pending' : 'awaiting_pix',
      error: null,
    })
    .eq('id', batchId);

  if (!moto?.pix_key) return { ok: false as const, error: 'motoboy ainda sem chave Pix' };
  const p = await processPayoutBatch(db, batchId, simulateOverride);
  return { ok: p.status === 'paid', ...p };
}

/** admin: marca um lote como pago manualmente (ex: transferência feita por fora). */
export async function markPayoutBatchPaid(db: DB, batchId: string, note: string) {
  const { error } = await db
    .from('payout_batches')
    .update({ status: 'paid', paid_at: new Date().toISOString(), external_ref: 'MANUAL', error: note.slice(0, 300) })
    .eq('id', batchId)
    .neq('status', 'paid');
  return { ok: !error };
}
