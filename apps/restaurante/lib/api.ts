import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@leeva/shared/types';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const badRequest = (msg: string) => json({ error: msg }, 400);
export const UUID = /^[0-9a-f-]{36}$/i;
export const unauthorized = () => json({ error: 'não autenticado' }, 401);
export const forbidden = (msg = 'sem permissão') => json({ error: msg }, 403);
export const notFound = (msg = 'não encontrado') => json({ error: msg }, 404);
export const tooManyRequests = (retryAfter = 30) =>
  NextResponse.json(
    { error: 'muitas requisições — tente novamente em instantes' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfter))) } },
  );

/**
 * Erro 500 seguro: registra o detalhe no servidor e devolve uma mensagem
 * genérica ao cliente (nunca vaza mensagem de banco / stack).
 */
export const serverError = (detail?: unknown) => {
  if (detail) console.error('[api] 500:', detail instanceof Error ? detail.message : detail);
  return json({ error: 'erro interno — tente novamente' }, 500);
};

/** Erro de regra de negócio: a mensagem do serviço é segura para exibir. */
export const businessError = (msg: string) => json({ error: msg }, 422);

/** Garante que um pedido pertence ao restaurante do contexto. */
export async function orderBelongsTo(
  db: SupabaseClient<Database>,
  orderId: string,
  restaurantId: string,
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return false;
  const { data } = await db.from('orders').select('restaurant_id').eq('id', orderId).maybeSingle();
  return data?.restaurant_id === restaurantId;
}
