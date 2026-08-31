/**
 * CRÉDITOS PRÉ-PAGOS — Fase 4 (Bloco 2)
 *
 * O restaurante compra crédito. Cada entrega desconta o TOTAL (valor do
 * motoboy + margem do plano) na criação do pedido. Sem saldo → não cria.
 * Cancelamento estorna. Débito/estorno são atômicos (funções no banco).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type DB = SupabaseClient<Database>;
export type CreditKind = Database['public']['Enums']['credit_movement'];

export type CreditBalance = {
  balance: number;
  lowThreshold: number;
  isLow: boolean;
};

export async function getCreditBalance(db: DB, restaurantId: string): Promise<CreditBalance> {
  const { data } = await db
    .from('restaurant_credits')
    .select('balance, low_balance_threshold')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  const balance = Number(data?.balance ?? 0);
  const lowThreshold = Number(data?.low_balance_threshold ?? 20);
  return { balance, lowThreshold, isLow: balance <= lowThreshold };
}

export type CreditEntry = {
  id: string;
  kind: CreditKind;
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  description: string;
  createdAt: string;
};

export async function getCreditHistory(db: DB, restaurantId: string, limit = 50): Promise<CreditEntry[]> {
  const { data } = await db
    .from('credit_ledger')
    .select('id, kind, amount, balance_after, order_id, description, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    amount: Number(r.amount),
    balanceAfter: Number(r.balance_after),
    orderId: r.order_id,
    description: r.description,
    createdAt: r.created_at,
  }));
}

export async function getCreditPackages(db: DB) {
  const { data } = await db
    .from('credit_packages')
    .select('id, amount, bonus, label, sort_order')
    .eq('active', true)
    .order('sort_order');
  return (data ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    bonus: Number(p.bonus),
    label: p.label,
  }));
}

/** Adiciona crédito (compra confirmada / bônus / ajuste). Devolve o novo saldo. */
export async function addCredit(
  db: DB,
  restaurantId: string,
  amount: number,
  kind: CreditKind,
  description: string,
  opts: { externalRef?: string; createdBy?: string } = {},
): Promise<number> {
  const { data, error } = await db.rpc('credit_add', {
    p_restaurant_id: restaurantId,
    p_amount: amount,
    p_kind: kind,
    p_description: description,
    p_external_ref: opts.externalRef ?? undefined,
    p_created_by: opts.createdBy ?? undefined,
  });
  if (error) throw error;
  return Number(data);
}

/** Consome crédito para um pedido. Atômico: só debita se houver saldo. */
export async function consumeCreditForOrder(
  db: DB,
  restaurantId: string,
  amount: number,
  orderId: string,
  description: string,
): Promise<{ ok: boolean; balance: number }> {
  const { data, error } = await db.rpc('credit_consume', {
    p_restaurant_id: restaurantId,
    p_amount: amount,
    p_order_id: orderId,
    p_description: description,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: !!row?.allowed, balance: Number(row?.new_balance ?? 0) };
}

/** Estorna o crédito consumido por um pedido cancelado. */
export async function refundCreditForOrder(db: DB, orderId: string): Promise<number | null> {
  const { data, error } = await db.rpc('credit_refund', { p_order_id: orderId });
  if (error) throw error;
  return data == null ? null : Number(data);
}
