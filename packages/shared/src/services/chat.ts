/**
 * CHAT DO PEDIDO — restaurante <-> motoboy, sem fraude/vazamento entre
 * pedidos alheios: sempre chamado depois de validar (na rota da API) que
 * quem está mandando é dono do pedido ou o motoboy atribuído a ele.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type DB = SupabaseClient<Database>;
export type ChatSenderType = 'restaurant' | 'motoboy';

export type ChatMessage = {
  id: string;
  senderType: ChatSenderType;
  senderId: string;
  body: string;
  createdAt: string;
};

export async function sendOrderMessage(
  db: DB,
  orderId: string,
  restaurantId: string,
  senderType: ChatSenderType,
  senderId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = body.trim().slice(0, 1000);
  if (!trimmed) return { ok: false, error: 'mensagem vazia' };
  const { error } = await db.from('order_messages').insert({
    order_id: orderId,
    restaurant_id: restaurantId,
    sender_type: senderType,
    sender_id: senderId,
    body: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getOrderMessages(db: DB, orderId: string, limit = 100): Promise<ChatMessage[]> {
  const { data } = await db
    .from('order_messages')
    .select('id, sender_type, sender_id, body, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return (data ?? []).map((m) => ({
    id: m.id,
    senderType: m.sender_type as ChatSenderType,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at,
  }));
}
