/**
 * Pipeline de webhooks de integração:
 *
 *   POST /api/webhooks/[provider]
 *     → verifyWebhook (assinatura/origem)
 *     → registra integration_events (idempotência por event_id)
 *     → provider.parse → NormalizedOrder
 *     → createOrderFromNormalized
 *     → integration_events.status = processed
 *
 * Tudo é logado. Segredos nunca vão para o log (só o payload e metadados).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { OrderSource, IntegrationProvider } from '../types';
import { getOrderProvider } from '../integrations/registry';
import { createOrderFromNormalized } from './orders';
import { sha256Hex } from '../lib/crypto';

type DB = SupabaseClient<Database>;

export type WebhookInput = {
  provider: IntegrationProvider;
  restaurantId: string | null;
  headers: Record<string, string>;
  rawBody: string;
  /** já parseado do rawBody */
  payload: unknown;
};

export type WebhookOutcome = {
  status: number;
  body: Record<string, unknown>;
};

const PROVIDER_TO_SOURCE: Partial<Record<IntegrationProvider, OrderSource>> = {
  ifood: 'ifood',
  whatsapp: 'whatsapp',
};

export async function processInboundWebhook(db: DB, input: WebhookInput): Promise<WebhookOutcome> {
  const source = PROVIDER_TO_SOURCE[input.provider];
  if (!source) return { status: 400, body: { error: `provider não suporta pedidos: ${input.provider}` } };

  const provider = getOrderProvider(source);

  // 1. assinatura / autenticidade
  const valid = await provider.verifyWebhook({ headers: input.headers, rawBody: input.rawBody });

  // 2. event_id para idempotência. Se o provider não mandou um id, usamos o
  //    hash do corpo — assim uma reentrega idêntica é detectada como
  //    duplicada em vez de criar um segundo pedido.
  const eventId =
    extractEventId(input.provider, input.payload) ??
    `body:${(await sha256Hex(input.rawBody || '{}')).slice(0, 32)}`;

  // 3. registra o evento
  const { data: evt, error: evtErr } = await db
    .from('integration_events')
    .insert({
      restaurant_id: input.restaurantId,
      provider: input.provider,
      direction: 'inbound',
      event_id: eventId,
      signature_valid: valid,
      status: valid ? 'received' : 'failed',
      error: valid ? null : 'assinatura inválida ou provider não configurado',
      payload: input.payload as Database['public']['Tables']['integration_events']['Insert']['payload'],
    })
    .select('id')
    .single();

  // idempotência: unique(provider, event_id) → 23505 significa duplicado
  if (evtErr) {
    if (evtErr.code === '23505') {
      await db
        .from('integration_events')
        .update({ status: 'duplicate' })
        .eq('provider', input.provider)
        .eq('event_id', eventId);
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    return { status: 500, body: { error: 'falha ao registrar o evento' } };
  }

  if (!valid) {
    return { status: 401, body: { error: 'assinatura inválida (ou integração ainda não configurada — PREPARADO)' } };
  }

  if (!input.restaurantId) {
    await db.from('integration_events').update({ status: 'ignored', error: 'restaurante não identificado' }).eq('id', evt.id);
    return { status: 202, body: { ok: true, note: 'evento recebido mas sem restaurante mapeado' } };
  }

  // o restaurante alvo precisa existir
  const { data: rest } = await db
    .from('restaurants')
    .select('id')
    .eq('id', input.restaurantId)
    .maybeSingle();
  if (!rest) {
    await db.from('integration_events').update({ status: 'ignored', error: 'restaurante inexistente' }).eq('id', evt.id);
    return { status: 404, body: { error: 'restaurante não encontrado' } };
  }

  // 4. normaliza
  const parsed = await provider.parse(input.payload);
  if (!parsed.ok) {
    await db.from('integration_events').update({ status: 'failed', error: parsed.error }).eq('id', evt.id);
    return { status: 422, body: { error: parsed.error } };
  }

  // 5. cria o pedido (idempotente também por source+external_id)
  const created = await createOrderFromNormalized(db, input.restaurantId, parsed.order, {
    integrationEventId: evt.id,
    requireConfirmation: input.provider === 'whatsapp', // IA nunca cria pedido sem confirmação
  });

  if (!created.ok) {
    await db.from('integration_events').update({ status: 'failed', error: created.error }).eq('id', evt.id);
    return { status: 500, body: { error: 'falha ao criar o pedido a partir do evento' } };
  }

  await db
    .from('integrations')
    .update({ last_event_at: new Date().toISOString() })
    .eq('restaurant_id', input.restaurantId)
    .eq('provider', input.provider);

  return {
    status: 200,
    body: {
      ok: true,
      order_id: created.orderId,
      order_number: created.orderNumber,
      duplicate: created.duplicate,
      needs_confirmation: input.provider === 'whatsapp',
    },
  };
}

function extractEventId(provider: IntegrationProvider, payload: unknown): string | null {
  const p = payload as Record<string, unknown>;
  if (provider === 'ifood') return (p?.id as string) ?? (p?.displayId as string) ?? null;
  if (provider === 'whatsapp') {
    // WhatsApp Cloud: entry[0].changes[0].value.messages[0].id
    try {
      const anyP = payload as {
        entry?: { changes?: { value?: { messages?: { id?: string }[] } }[] }[];
      };
      return anyP.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }
  return null;
}
