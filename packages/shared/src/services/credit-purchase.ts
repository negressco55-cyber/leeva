/**
 * COMPRA DE CRÉDITO VIA PIX (Asaas) — Fase 4 (Bloco 3)
 *
 * Fluxo:
 *   restaurante escolhe pacote  -> startCreditPurchase()
 *     -> cria linha em credit_purchases (status 'pending')
 *     -> gera cobrança Pix na Asaas (invoiceUrl + copia-e-cola)
 *   restaurante paga o Pix
 *   Asaas chama /api/webhooks/asaas -> confirmCreditPurchase()
 *     -> libera o crédito (addCredit) + marca 'paid'  [idempotente]
 *
 * Sem ASAAS_API_KEY no ambiente: MODO SIMULAÇÃO — libera o crédito na hora
 * e marca a compra como paga/simulada (comportamento de dev, claramente
 * sinalizado na resposta).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { getAsaasClient } from './asaas';
import { addCredit, getCreditPackages } from './credits';

type DB = SupabaseClient<Database>;
const round = (n: number) => Math.round(n * 100) / 100;

export type StartPurchaseInput = { packageId?: string; amount?: number; cpfCnpj?: string };
export type StartPurchaseResult =
  | {
      ok: true;
      purchaseId: string;
      status: 'pending' | 'paid';
      simulated: boolean;
      gross: number;
      amount: number;
      bonus: number;
      invoiceUrl?: string;
      pixCopyPaste?: string;
      balance?: number;
    }
  | { ok: false; error: string; code?: 'need_cpf_cnpj' };

export const MIN_CREDIT_PURCHASE = 3;

/** Resolve pacote/valor -> { amount, bonus, gross }. */
async function resolveAmount(
  db: DB,
  input: StartPurchaseInput,
): Promise<{ amount: number; bonus: number; packageId: string | null } | { error: string }> {
  if (input.packageId) {
    const pkgs = await getCreditPackages(db);
    const p = pkgs.find((x) => x.id === input.packageId);
    if (!p) return { error: 'pacote inválido' };
    return { amount: p.amount, bonus: p.bonus, packageId: p.id };
  }
  if (input.amount && input.amount > 0) {
    const amount = Math.min(5000, round(Number(input.amount)));
    if (amount < MIN_CREDIT_PURCHASE) return { error: `valor mínimo de R$ ${MIN_CREDIT_PURCHASE},00` };
    return { amount, bonus: 0, packageId: null };
  }
  return { error: 'informe um pacote ou valor' };
}

/** Acha o cliente Asaas do restaurante em restaurants.settings, ou cria um. */
async function resolveAsaasCustomer(
  db: DB,
  restaurantId: string,
  asaas: NonNullable<ReturnType<typeof getAsaasClient>>,
  cpfCnpj?: string,
): Promise<{ ok: true; customerId: string } | { ok: false; error: string; code?: 'need_cpf_cnpj' }> {
  const { data: r } = await db
    .from('restaurants')
    .select('name, phone, settings')
    .eq('id', restaurantId)
    .maybeSingle();
  const settings = (r?.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>;
  const asaasCfg = (settings.asaas && typeof settings.asaas === 'object' ? settings.asaas : {}) as {
    customerId?: string;
  };
  if (asaasCfg.customerId) return { ok: true, customerId: asaasCfg.customerId };

  const doc = (cpfCnpj ?? '').replace(/\D/g, '');
  if (doc.length !== 11 && doc.length !== 14) {
    return { ok: false, error: 'informe um CNPJ ou CPF válido para a cobrança', code: 'need_cpf_cnpj' };
  }

  const created = await asaas.createCustomer({
    name: r?.name ?? 'Restaurante Leeva',
    cpfCnpj: doc,
    mobilePhone: r?.phone ?? undefined,
  });
  if (!created.ok) return { ok: false, error: `não foi possível registrar o pagador: ${created.error}` };

  await db
    .from('restaurants')
    .update({ settings: { ...settings, asaas: { ...asaasCfg, customerId: created.data.id, cpfCnpj: doc } } })
    .eq('id', restaurantId);

  return { ok: true, customerId: created.data.id };
}

export async function startCreditPurchase(
  db: DB,
  restaurantId: string,
  input: StartPurchaseInput,
  opts: { createdBy?: string } = {},
): Promise<StartPurchaseResult> {
  const resolved = await resolveAmount(db, input);
  if ('error' in resolved) return { ok: false, error: resolved.error };
  const { amount, bonus, packageId } = resolved;
  const gross = amount; // hoje 1:1 (R$ pago = crédito liberado); margem/taxa entram aqui depois

  const asaas = getAsaasClient();

  // A cobrança da Asaas exige um "cliente" (o pagador). Resolve/cria antes de
  // registrar a compra, pra não deixar linha pendente órfã se faltar o CNPJ.
  let customerId: string | undefined;
  if (asaas) {
    const cust = await resolveAsaasCustomer(db, restaurantId, asaas, input.cpfCnpj);
    if (!cust.ok) return cust;
    customerId = cust.customerId;
  }

  // linha de controle
  const { data: row, error: insErr } = await db
    .from('credit_purchases')
    .insert({
      restaurant_id: restaurantId,
      package_id: packageId,
      amount,
      bonus,
      gross,
      status: 'pending',
      simulated: !asaas,
      created_by: opts.createdBy ?? null,
    })
    .select('id')
    .single();
  if (insErr || !row) return { ok: false, error: 'não foi possível iniciar a compra' };

  // ----- MODO SIMULAÇÃO (sem Asaas) -----
  if (!asaas) {
    const balance = await creditOnce(db, row.id, restaurantId, amount, bonus, 'SIMULADO', opts.createdBy);
    return {
      ok: true,
      purchaseId: row.id,
      status: 'paid',
      simulated: true,
      gross,
      amount,
      bonus,
      balance,
    };
  }

  // ----- COBRANÇA PIX REAL -----
  const charge = await asaas.createPixCharge({
    customer: customerId!,
    value: gross,
    description: `Leeva — crédito de entregas (R$ ${amount.toFixed(2)})`,
    externalReference: row.id,
    dueInDays: 1,
  });

  if (!charge.ok) {
    await db.from('credit_purchases').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', row.id);
    return { ok: false, error: `não foi possível gerar o Pix: ${charge.error}` };
  }

  await db
    .from('credit_purchases')
    .update({
      external_id: charge.data.id,
      invoice_url: charge.data.invoiceUrl,
      pix_copy_paste: charge.data.pixCopyPaste ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  return {
    ok: true,
    purchaseId: row.id,
    status: 'pending',
    simulated: false,
    gross,
    amount,
    bonus,
    invoiceUrl: charge.data.invoiceUrl,
    pixCopyPaste: charge.data.pixCopyPaste,
  };
}

/**
 * Confirma o pagamento de uma compra (chamado pelo webhook da Asaas).
 * Idempotente: se já estiver paga, não credita de novo.
 */
export async function confirmCreditPurchase(
  db: DB,
  ref: { purchaseId?: string; externalId?: string },
): Promise<{ ok: boolean; alreadyPaid?: boolean; balance?: number; error?: string }> {
  let q = db.from('credit_purchases').select('id, restaurant_id, amount, bonus, status, external_id, created_by');
  if (ref.purchaseId) q = q.eq('id', ref.purchaseId);
  else if (ref.externalId) q = q.eq('external_id', ref.externalId);
  else return { ok: false, error: 'referência ausente' };

  const { data: p } = await q.maybeSingle();
  if (!p) return { ok: false, error: 'compra não encontrada' };
  if (p.status === 'paid') return { ok: true, alreadyPaid: true };
  if (p.status === 'refunded') return { ok: false, error: 'compra estornada' };

  const balance = await creditOnce(
    db,
    p.id,
    p.restaurant_id,
    Number(p.amount),
    Number(p.bonus),
    p.external_id ?? p.id,
    p.created_by ?? undefined,
  );
  return { ok: true, balance };
}

/** Marca uma compra como falha/expirada (Pix vencido, cancelado). */
export async function failCreditPurchase(
  db: DB,
  ref: { externalId?: string; purchaseId?: string },
  status: 'failed' | 'expired' = 'failed',
): Promise<void> {
  const patch = { status, updated_at: new Date().toISOString() };
  if (ref.externalId) await db.from('credit_purchases').update(patch).eq('external_id', ref.externalId).eq('status', 'pending');
  else if (ref.purchaseId) await db.from('credit_purchases').update(patch).eq('id', ref.purchaseId).eq('status', 'pending');
}

/** Credita o valor + bônus e marca a compra como paga. Chama-se no máximo uma vez. */
async function creditOnce(
  db: DB,
  purchaseId: string,
  restaurantId: string,
  amount: number,
  bonus: number,
  externalRef: string,
  createdBy?: string,
): Promise<number> {
  // trava otimista: só segue se a linha ainda não estava 'paid'
  const { data: locked } = await db
    .from('credit_purchases')
    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', purchaseId)
    .neq('status', 'paid')
    .select('id')
    .maybeSingle();
  if (!locked) {
    // já estava paga — devolve o saldo atual sem creditar de novo
    const { data: rc } = await db.from('restaurant_credits').select('balance').eq('restaurant_id', restaurantId).maybeSingle();
    return Number(rc?.balance ?? 0);
  }

  let balance = await addCredit(db, restaurantId, amount, 'purchase', `Compra de crédito — R$ ${amount.toFixed(2)}`, {
    externalRef,
    createdBy,
  });
  if (bonus > 0) {
    balance = await addCredit(db, restaurantId, bonus, 'bonus', `Bônus do pacote — R$ ${bonus.toFixed(2)}`, { externalRef });
  }
  return balance;
}

export type CreditPurchaseRow = {
  id: string;
  status: string;
  amount: number;
  bonus: number;
  gross: number;
  simulated: boolean;
  invoiceUrl: string | null;
  createdAt: string;
  paidAt: string | null;
};

export async function listCreditPurchases(db: DB, restaurantId: string, limit = 10): Promise<CreditPurchaseRow[]> {
  const { data } = await db
    .from('credit_purchases')
    .select('id, status, amount, bonus, gross, simulated, invoice_url, created_at, paid_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    amount: Number(r.amount),
    bonus: Number(r.bonus),
    gross: Number(r.gross),
    simulated: !!r.simulated,
    invoiceUrl: r.invoice_url,
    createdAt: r.created_at,
    paidAt: r.paid_at,
  }));
}

export async function getCreditPurchase(db: DB, restaurantId: string, purchaseId: string) {
  const { data } = await db
    .from('credit_purchases')
    .select('id, status, amount, bonus, gross, simulated, invoice_url, pix_copy_paste, created_at, paid_at')
    .eq('restaurant_id', restaurantId)
    .eq('id', purchaseId)
    .maybeSingle();
  return data ?? null;
}
